import type { ViteEnvironment } from '@vite-env/core'
import { EdgeVM } from '@edge-runtime/vm'
import { Miniflare } from 'miniflare'
import type { SharedOptions, WorkerOptions } from 'miniflare'
import path from 'node:path'
import fs from 'node:fs'

const extensions = ['ts', 'js', 'mts', 'mjs']

type Options = {
  miniflareOptions?: Omit<SharedOptions & WorkerOptions, 'script' | 'modules'>
  /**
   * Whether to inject bindings as a global variable `$GlobalBindings`.
   *
   * Intended to be used for tests.
   */
  enableGlobalBindings?: boolean
}

export const cloudflarePagesEnv = ({ miniflareOptions = {}, ...additionalOptions }: Options): ViteEnvironment => {
  return {
    key: 'workerd',
    async setup() {
      // TODO: wasm import support

      if (miniflareOptions.compatibilityFlags?.includes('nodejs_compat')) {
        // TODO: Should be possible by adding a global variable that accesses the Node.js modules
        // and loading virtual module for `node:*` imports
        // https://developers.cloudflare.com/workers/runtime-apis/nodejs/
        throw new Error("Currently doesn't support Node.js compat")
      }

      const mf = new Miniflare({
        ...miniflareOptions,
        // https://github.com/cloudflare/miniflare/pull/639#issuecomment-1651304980
        script: '',
        modules: true
      })
      const bindings = await mf.getBindings()

      const isNavigatorUserAgentEnabled =
        !!miniflareOptions.compatibilityFlags?.includes('global_navigator')

      const caches = await mf.getCaches()
      const edgeRuntimeEnv = new EdgeVM({
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
          if (additionalOptions?.enableGlobalBindings) {
            context.$GlobalBindings = bindings
          }
          return context
        }
      })

      return {
        getVmContext() {
          return edgeRuntimeEnv.context
        },
        async runModule(module, request, ctx) {
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
            ...bindings,
            ASSETS: {
              async fetch(req: Request) {
                // NOTE: If Vite uses Universal/Modern middlewares in the future,
                //       we can avoid using actual HTTP requests.
                //       Or if we can convert Node middlewares into them.
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
          await mf.dispose()
        }
      }
    }
  }
}
