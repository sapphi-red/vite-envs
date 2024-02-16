import { createViteRuntime, type Plugin } from 'vite'
import type { ViteEnvApi } from '@vite-runtime/types'
import { createMiddleware } from '@hattip/adapter-node'
import path from 'node:path'

export const exampleFramework = (entrypoint: string): Plugin => {
  let runtimeEnvPlugin: Plugin<ViteEnvApi> | undefined
  let resolvedEntrypoint!: string
  let teardown: (() => void | Promise<void>) | undefined

  return {
    name: 'example-framework',
    configResolved(config) {
      resolvedEntrypoint = path.resolve(config.root, entrypoint)

      const runtimeEnvPlugins = config.plugins.filter(
        (plugin) => plugin.api && 'createRuntime' in plugin.api
      ) as Plugin<ViteEnvApi>[]
      if (runtimeEnvPlugins.length > 2) {
        throw new Error('Multiple runtime env plugin should not be used')
      }

      if (runtimeEnvPlugins.length === 1) {
        runtimeEnvPlugin = runtimeEnvPlugins[0]
      }
    },
    async configureServer(server) {
      const runtime = await (runtimeEnvPlugin
        ? runtimeEnvPlugin.api!.createRuntime(server)
        : createViteRuntime(server))
      const dispatchRequest =
        'dispatchRequest' in runtime && runtime.dispatchRequest
          ? (request: Request) => {
              return runtime.dispatchRequest!(resolvedEntrypoint, request)
            }
          : async (request: Request) => {
              const module = (await runtime.executeUrl!(
                resolvedEntrypoint
              )) as { [Symbol.toStringTag]: 'Module' }
              if (
                !('default' in module) ||
                typeof module.default !== 'function'
              )
                throw new Error('should have a default export of function type')
              return module.default(request)
            }
      teardown = 'teardown' in runtime ? runtime.teardown : undefined

      const middleware = createMiddleware(
        async (ctx) => {
          return await dispatchRequest(ctx.request)
        },
        { alwaysCallNext: false }
      )

      server.middlewares.use((req, res, next) => {
        if (req.url!.startsWith('/api/')) {
          middleware(req, res, next)
          return
        }
        next()
      })
    },
    async buildEnd() {
      await teardown?.()
    }
  }
}
