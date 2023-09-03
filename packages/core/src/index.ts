import { createServer, resolveConfig } from 'vite'
import { ViteNodeServer } from 'vite-node/server'
import { ViteNodeRunner } from 'vite-node/client'
import { createHotContext, viteNodeHmrPlugin } from 'vite-node/hmr'
import { installSourcemapsSupport } from 'vite-node/source-map'

export type { ViteEnvironment, ViteEnvironmentInfo } from './types.js'

export const setup = async () => {
  const inlineConfig = {
    plugins: [viteNodeHmrPlugin()],
    optimizeDeps: {
      disabled: true
    }
  }
  const config = await resolveConfig(inlineConfig, 'serve')

  if (!config.ssr.environment) {
    throw new Error('ssr.environment is required for vite-env')
  }

  const env = await config.ssr.environment.setup()

  const server = await createServer(inlineConfig)
  process.once('SIGTERM', async () => {
    try {
      await Promise.allSettled([server.close(), env.teardown()])
    } finally {
      process.exit()
    }
  })

  await server.pluginContainer.buildStart({})

  const node = new ViteNodeServer(server)

  installSourcemapsSupport({
    getSourceMap: (source) => node.getSourceMap(source)
  })

  const runner = new ViteNodeRunner({
    root: server.config.root,
    base: server.config.base,
    fetchModule(id) {
      return node.fetchModule(id)
    },
    resolveId(id, importer) {
      return node.resolveId(id, importer)
    },
    createHotContext(runner, url) {
      return createHotContext(runner, server.emitter, [], url)
    },
    vmContext: env.getVmContext()
  })

  // provide the vite define variable in this context
  await runner.executeId('/@vite/env')

  return { config: server.config, env, runner }
}
