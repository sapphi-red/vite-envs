import { createServer } from 'vite'
import { ViteNodeServer } from 'vite-node/server'
import { ViteNodeRunner } from 'vite-node/client'
import { createHotContext, viteNodeHmrPlugin } from 'vite-node/hmr'
import { installSourcemapsSupport } from 'vite-node/source-map'
import { EdgeVM } from '@edge-runtime/vm'
import { createServer as createHattipServer } from '@hattip/adapter-node'
import { Miniflare } from 'miniflare'
import httpProxy from 'http-proxy'

export const dev = async () => {
  const edgeRuntimeEnv = new EdgeVM()
  const mf = new Miniflare({
    // https://github.com/cloudflare/miniflare/pull/639#issuecomment-1651304980
    script: '',
    modules: true,
    kvNamespaces: ['FOO_KV']
  })
  const bindings = await mf.getBindings()

  const server = await createServer({
    root: process.cwd(),
    plugins: [viteNodeHmrPlugin()],
    optimizeDeps: {
      disabled: true
    }
  })
  process.once('SIGTERM', async () => {
    try {
      await Promise.allSettled([server.close(), mf.dispose()])
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
    vmContext: edgeRuntimeEnv.context
  })

  // provide the vite define variable in this context
  await runner.executeId('/@vite/env')

  const proxyServer = httpProxy.createProxyServer({
    target: 'http://localhost:5173',
    ws: true
  })
  const hattipServer = createHattipServer(async (ctx) => {
    // TODO: should "page reload" clear all modules on vite-node side?
    runner.moduleCache.deleteByModuleId('/_worker.ts')
    const worker = await runner.executeFile('/_worker.ts')

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
    const res = await worker.default.fetch(ctx.request, env, context)
    return res
  })

  hattipServer.on('upgrade', (req, socket, head) => {
    proxyServer.ws(req, socket, head)
  })

  hattipServer.listen(51733, 'localhost', () => {
    console.log('Server listening on http://localhost:51733')
  })
}
