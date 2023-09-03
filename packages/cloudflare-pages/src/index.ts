import type { ViteEnvironment } from '@vite-env/core'
import { EdgeVM } from '@edge-runtime/vm'
import { Miniflare } from 'miniflare'
import type { SharedOptions, WorkerOptions } from 'miniflare'

export const cloudflarePagesEnv = (
  miniflareOptions: Omit<SharedOptions & WorkerOptions, 'script' | 'modules'>
): ViteEnvironment => {
  return {
    async setup() {
      if (miniflareOptions.compatibilityFlags?.includes('nodejs_compat')) {
        // Should be possible by adding a global variable that accesses the Node.js modules
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
        extend(context) {
          context.caches = caches
          if (isNavigatorUserAgentEnabled) {
            context.navigator ||= {}
            context.navigator.userAgent = 'Cloudflare-Workers'
          }
          return context
        }
      })

      return {
        getVmContext() {
          return edgeRuntimeEnv.context
        },
        async runModule(module, request) {
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

          const env = {
            ...bindings,
            ASSETS: {
              async fetch(req: Request) {
                const newUrl = new URL(req.url)
                newUrl.protocol = 'http'
                newUrl.host = 'localhost:5173'
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
        async teardown() {
          await mf.dispose()
        }
      }
    }
  }
}
