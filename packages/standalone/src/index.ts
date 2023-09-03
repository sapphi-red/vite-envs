import { createServer as createHattipServer } from '@hattip/adapter-node'
import httpProxy from 'http-proxy'
import { setup } from '@vite-env/core'

export const dev = async () => {
  const { env, runner } = await setup()
  if (!env.runModule) {
    throw new Error('this environment is not supported by vite-env standalone')
  }

  const proxyServer = httpProxy.createProxyServer({
    target: 'http://localhost:5173',
    ws: true
  })
  const hattipServer = createHattipServer(async (ctx) => {
    // TODO: should "page reload" clear all modules on vite-node side?
    runner.moduleCache.deleteByModuleId('/_worker.ts')
    const module = await runner.executeFile('/_worker.ts')

    const res = await env.runModule!(module, ctx.request)
    return res
  })

  hattipServer.on('upgrade', (req, socket, head) => {
    proxyServer.ws(req, socket, head)
  })

  hattipServer.listen(51733, 'localhost', () => {
    console.log('Server listening on http://localhost:51733')
  })
}
