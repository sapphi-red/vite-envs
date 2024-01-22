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

  async runViteModule(
    context: ViteRuntimeModuleContext,
    transformed: string
  ): Promise<any> {
    if (!this.unsafeEval) throw new Error('unsafeEval module is not set')

    const initModule = this.unsafeEval.newAsyncFunction(
      '"use strict";' + transformed,
      // TODO: use file name as function name
      'virtual',
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
