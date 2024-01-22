import { createViteRuntime, type ViteDevServer } from 'vite'
import {
  type ViteRuntimeModuleContext,
  ssrModuleExportsKey,
  ssrImportMetaKey,
  ssrImportKey,
  ssrDynamicImportKey,
  ssrExportAllKey,
  type ResolvedResult,
  type SSRImportMetadata,
  ViteRuntime,
  type ViteModuleRunner
} from 'vite/runtime'
import { EdgeVM } from '@edge-runtime/vm'
import type { ViteStandaloneRuntime } from '@vite-runtime/standalone'
import path from 'node:path'
import fs from 'node:fs'
import { Miniflare } from 'miniflare'
import type { SharedOptions, WorkerOptions } from 'miniflare'

type Options = {
  miniflareOptions?: Omit<SharedOptions & WorkerOptions, 'script' | 'modules'>
}

export const createCloudflarePagesRuntime = async (
  server: ViteDevServer,
  options?: Options
): Promise<ViteRuntime> => {
  const runner = new CloudflarePagesRunner(options)
  await runner.setup()
  // TODO: where to call teardown?
  return createViteRuntime(server, { runner })
}

class CloudflarePagesRunner implements ViteModuleRunner {
  private options: Options
  private enableNodeJsCompat!: boolean
  private vm!: EdgeVM
  private mf!: Miniflare

  bindings!: Record<string, unknown>

  constructor(options: Options | undefined) {
    this.options = options || {}
  }

  async setup() {
    // TODO: wasm import support
    // TODO: support `cloudflare:*` modules and `workerd:*` modules
    const { miniflareOptions = {} } = this.options

    const parsedCompatDate = parseCompatibilityDate(
      miniflareOptions.compatibilityDate
    )
    this.enableNodeJsCompat =
      miniflareOptions.compatibilityFlags?.includes('nodejs_compat') ?? false

    const mf = (this.mf = new Miniflare({
      ...miniflareOptions,
      // https://github.com/cloudflare/miniflare/pull/639#issuecomment-1651304980
      script: '',
      modules: true
    }))
    this.bindings = await mf.getBindings()

    const isNavigatorUserAgentEnabled = isCompatibilityEnabled(
      parsedCompatDate,
      miniflareOptions.compatibilityFlags,
      '2022-03-21',
      'global_navigator',
      'no_global_navigator'
    )

    const caches = await mf.getCaches()
    this.vm = new EdgeVM({
      codeGeneration: {
        // https://developers.cloudflare.com/workers/runtime-apis/web-standards/#javascript-standards
        strings: false,
        // It's not documented but I **guess** it's not allowed
        // Example code doesn't use
        // https://developers.cloudflare.com/workers/runtime-apis/webassembly/javascript/#use-from-javascript
        wasm: false
      },
      extend(context) {
        // NOTE: context.EdgeRuntime doesn't exist in CF Workers but preserve that
        // because context.EdgeRuntime is defined with `configure: false`
        // instead change the value (`writable: true` is set)
        context.EdgeRuntime = ''

        context.caches = caches
        if (isNavigatorUserAgentEnabled) {
          context.navigator ||= {}
          context.navigator.userAgent = 'Cloudflare-Workers'
        }
        return context
      }
    })
  }

  async teardown() {
    await this.mf.dispose()
  }

  async runViteModule(
    context: ViteRuntimeModuleContext,
    transformed: string
  ): Promise<any> {
    // TODO: use file name as function name
    const initModule = this.vm.evaluate(
      `(async function(${ssrModuleExportsKey},${ssrImportMetaKey},${ssrImportKey},${ssrDynamicImportKey},${ssrExportAllKey}){"use strict";${transformed}})`
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
    if (!this.enableNodeJsCompat) {
      throw new Error('Node JS Compat is not enabled.')
    }

    // TODO: support Node.js modules
    // https://developers.cloudflare.com/workers/runtime-apis/nodejs/
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

export const cloudflareStandalone = (
  options?: Options
): ViteStandaloneRuntime => {
  const extensions = ['ts', 'js', 'mts', 'mjs']

  return {
    key: 'workerd',
    async setup(server: ViteDevServer) {
      const runtime = await createCloudflarePagesRuntime(server, options)

      return {
        async runModule(id, request, ctx) {
          const module = await runtime.executeEntrypoint(id)

          if (!('default' in module)) {
            throw new Error('default export should exist')
          }
          if (
            !(typeof module.default === 'object' && module.default !== null)
          ) {
            throw new Error('default export should be object')
          }
          if (!('fetch' in module.default)) {
            throw new Error('fetch function should exist in default export')
          }
          if (!(typeof module.default.fetch === 'function')) {
            throw new Error('fetch in default export should be a function')
          }

          const viteUrl = new URL(ctx.viteUrl)

          const env = {
            ...(runtime.runner as CloudflarePagesRunner).bindings,
            ASSETS: {
              async fetch(req: Request) {
                // NOTE: If Vite uses Universal/Modern middlewares in the future,
                //       we can avoid using actual HTTP requests.
                //       It's difficult to convert Node middlewares into them.
                //       https://github.com/fastly/http-compute-js#notes--known-issues
                const newUrl = new URL(req.url)
                newUrl.protocol = viteUrl.protocol
                newUrl.host = viteUrl.host
                try {
                  return await fetch(new Request(newUrl.href, req))
                } catch (e) {
                  console.error('Failed to execute ASSETS.fetch: ', e)
                  return new Response(null, { status: 500 })
                }
              }
            }
          }
          const context = {
            waitUntil() {}, // TODO: impl
            passThroughOnException() {} // TODO: impl
          }
          return await module.default.fetch(request, env, context)
        },
        // TODO: support non-Advanced mode
        selectModule(_request, root) {
          for (const ext of extensions) {
            const p = path.resolve(root, `_worker.${ext}`)
            try {
              const stat = fs.statSync(p, { throwIfNoEntry: false })
              if (stat) {
                return p
              }
            } catch {}
          }
          return undefined
        },
        async teardown() {
          await (runtime.runner as CloudflarePagesRunner).teardown()
        }
      }
    }
  }
}

const parseCompatibilityDate = (date: string | undefined) => {
  const m = date?.match(/^\d+-\d+-\d+$/)
  if (!m) return new Date(0)
  return new Date(+m[1], +m[2], +m[3])
}

const isCompatibilityEnabled = (
  parsedDate: Date,
  flags: string[] | undefined,
  defaultEnabledAtStr: string,
  flagToEnable: string,
  flagToDisable: string
) => {
  if (flags?.includes(flagToEnable)) return true
  if (flags?.includes(flagToDisable)) return true

  const defaultEnabledAt = parseCompatibilityDate(defaultEnabledAtStr)
  return parsedDate >= defaultEnabledAt
}
