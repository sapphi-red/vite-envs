import type { ViteEnvironment } from '@vite-env/core'
import { EdgeVM } from '@edge-runtime/vm'
import { Miniflare } from 'miniflare'
import type { SharedOptions, WorkerOptions } from 'miniflare'

export const cloudflarePagesEnv = (
  miniflareOptions: Omit<SharedOptions & WorkerOptions, 'script' | 'modules'>
): ViteEnvironment => {
  return {
    async setup() {
      const edgeRuntimeEnv = new EdgeVM()
      const mf = new Miniflare({
        ...miniflareOptions,
        // https://github.com/cloudflare/miniflare/pull/639#issuecomment-1651304980
        script: '',
        modules: true,
      })
      const bindings = await mf.getBindings()

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
              fetch(req: Request) {
                const newUrl = new URL(req.url)
                newUrl.protocol = 'http'
                newUrl.host = 'localhost:5173'
                return fetch(new Request(newUrl.href, req))
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
