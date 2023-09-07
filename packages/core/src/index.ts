/// <reference path="./config.ts" />
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

  const viteServer = await createServer(inlineConfig)
  process.once('SIGTERM', async () => {
    try {
      await Promise.allSettled([viteServer.close(), env.teardown()])
    } finally {
      process.exit()
    }
  })

  await viteServer.pluginContainer.buildStart({})

  const node = new ViteNodeServer(viteServer)

  installSourcemapsSupport({
    getSourceMap: (source) => node.getSourceMap(source)
  })

  const runner = new ViteNodeRunner({
    root: viteServer.config.root,
    base: viteServer.config.base,
    fetchModule(id) {
      return node.fetchModule(id)
    },
    resolveId(id, importer) {
      return node.resolveId(id, importer)
    },
    createHotContext(runner, url) {
      return createHotContext(runner, viteServer.emitter, [], url)
    },
    vmContext: env.getVmContext()
  })
  await runner.setup()

  // provide the vite define variable in this context
  await runner.executeId('/@vite/env')

  return { viteServer, env, runner }
}
