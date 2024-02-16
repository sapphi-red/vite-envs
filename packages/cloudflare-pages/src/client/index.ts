import {
  ViteRuntime,
  type ViteModuleRunner,
  type ViteRuntimeModuleContext,
  ssrModuleExportsKey,
  ssrImportMetaKey,
  ssrImportKey,
  ssrExportAllKey,
  ssrDynamicImportKey,
  type ResolvedResult,
  type SSRImportMetadata,
  type HMRRuntimeConnection
} from 'vite/runtime'
import { createBirpc, type BirpcReturn } from 'birpc'
import type { ClientFunctions, ServerFunctions } from '../types.js'
import type { Response } from '@cloudflare/workers-types'
import type { HMRPayload } from 'vite'
import { makeLegalIdentifier } from '@rollup/pluginutils'

declare const __ROOT__: string

let rpc: BirpcReturn<ServerFunctions, ClientFunctions>
let onHmrRecieve: ((payload: HMRPayload) => void) | undefined

const setupRpc = async () => {
  if (rpc) return

  const resp = (await fetch('http://localhost:9400', {
    headers: {
      Upgrade: 'websocket'
    }
  })) as unknown as Response
  const ws = resp.webSocket
  if (!ws) {
    throw new Error('ws failed to connect')
  }
  ws.accept()

  const clientFunctions: ClientFunctions = {
    hmrSend(payload) {
      onHmrRecieve?.(payload)
    }
  }
  rpc = createBirpc<ServerFunctions, ClientFunctions>(clientFunctions, {
    post: (data) => ws.send(data),
    on: (data) => ws.addEventListener('message', (e) => data(e.data)),
    serialize: (v) => JSON.stringify(v),
    deserialize: (v) => JSON.parse(v)
  })
}

const hmrConnection: HMRRuntimeConnection = {
  isReady() {
    return !!rpc
  },
  send(messages: string) {
    console.log('send:', messages)
  },
  onUpdate(h: any) {
    onHmrRecieve = h
    return () => {
      onHmrRecieve = undefined
    }
  }
}

type UnsafeEvalModule = {
  newAsyncFunction(code: string, name?: string, ...args: string[]): Function
}

class CloudflarePagesRunner implements ViteModuleRunner {
  unsafeEval: UnsafeEvalModule | undefined
  private idMap = new Map<string, string[]>()

  async runViteModule(
    context: ViteRuntimeModuleContext,
    code: string,
    id: string
  ): Promise<any> {
    if (!this.unsafeEval) throw new Error('unsafeEval module is not set')

    const escapedId = makeLegalIdentifier(id)

    if (!this.idMap.has(escapedId)) {
      this.idMap.set(escapedId, [])
    }
    const idList = this.idMap.get(escapedId)!
    let number = idList.indexOf(id)
    if (number < 0) {
      number = idList.push(id) - 1
    }

    // @ts-expect-error import.meta.filename doesn't exist
    delete context[ssrImportMetaKey].filename
    // @ts-expect-error import.meta.dirname doesn't exist
    delete context[ssrImportMetaKey].dirname

    const initModule = this.unsafeEval.newAsyncFunction(
      '"use strict";' + code,
      `${escapedId}_${number}`,
      ssrModuleExportsKey,
      ssrImportMetaKey,
      ssrImportKey,
      ssrDynamicImportKey,
      ssrExportAllKey
    )
    await initModule(
      context[ssrModuleExportsKey],
      context[ssrImportMetaKey],
      context[ssrImportKey],
      context[ssrDynamicImportKey],
      context[ssrExportAllKey]
    )
    Object.freeze(context[ssrModuleExportsKey])
  }

  runExternalModule(_filepath: string): Promise<any> {
    // TODO: support Node.js modules
    // https://developers.cloudflare.com/workers/runtime-apis/nodejs/
    // TODO: support `cloudflare:*` modules and `workerd:*` modules
    throw new Error('Not supported')
  }

  processImport(
    mod: Record<string, any>,
    _fetchResult: ResolvedResult,
    _metadata?: SSRImportMetadata | undefined
  ): Record<string, any> {
    return mod
  }

  getGetRealFilenameFromEscapedId(escapedIdWithSuffix: string) {
    const match = escapedIdWithSuffix.match(/^(.+)_(\d+)$/)
    if (!match) return undefined

    const escapedId = match[1]
    const number = +match[2]

    return this.idMap.get(escapedId)?.[number]
  }
}

const runner = new CloudflarePagesRunner()
const runtime = new ViteRuntime(
  {
    root: __ROOT__,
    fetchModule: (id, importer) => rpc.fetchModule(id, importer),
    hmr: {
      connection: hmrConnection
    }
  },
  runner
)
// exists because ViteRuntime assigns it
const originalPrepareStackTrace = Error.prepareStackTrace!
Error.prepareStackTrace = (error, stacks) => {
  const wrappedStacks = stacks.map(
    (stack) =>
      new Proxy(stack as any, {
        get(target, key, receiver) {
          const value = target[key]
          if (value instanceof Function) {
            return function (this: any, ...args: any[]) {
              const result = value.apply(
                this === receiver ? target : this,
                args
              )
              if (key === 'getFileName' && typeof result === 'string') {
                const realFilename =
                  runner.getGetRealFilenameFromEscapedId(result)
                return realFilename ?? result
              }
              return result
            }
          }
          return value
        }
      })
  )
  return originalPrepareStackTrace(error, wrappedStacks)
}

export default {
  async fetch(req: Request, env: any, ctx: any) {
    await setupRpc()
    runner.unsafeEval = env.UNSAFE_EVAL

    const executeUrl = req.headers.get('vite-runtime-execute-url')
    if (executeUrl === null) {
      throw new Error('executeUrl should not be empty')
    }

    const module = await runtime.executeEntrypoint(executeUrl)
    return module.default.fetch(req, env, ctx)
  }
}
