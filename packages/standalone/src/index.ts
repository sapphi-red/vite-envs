import { createServer as createHattipServer } from '@hattip/adapter-node'
import httpProxy from 'http-proxy'
import { setup } from '@vite-env/core'
import path from 'node:path'
import { normalizePath } from 'vite'

export const dev = async () => {
  const { viteServer, env, runner } = await setup()
  if (!env.runModule) {
    throw new Error('this environment is not supported by vite-env standalone')
  }

  const entry = viteServer.config.build.ssr
  if (typeof entry !== 'string') {
    throw new Error('build.ssr is required to use vite-env standalone')
  }
  const resolvedEntry = normalizePath(
    path.resolve(viteServer.config.root, entry)
  )

  // handle unhandledRejection so that the process won't exit
  process.on('unhandledRejection', (err) => {
    console.log('Unhandled Rejection: ', err)
  })

  await viteServer.listen()
  const viteUrl =
    viteServer.resolvedUrls!.local[0] ?? viteServer.resolvedUrls!.network[0]

  const proxyServer = httpProxy.createProxyServer({
    target: viteUrl,
    ws: true
  })
  const hattipServer = createHattipServer(async (ctx) => {
    try {
      // TODO: should "page reload" clear all modules on vite-node side?
      runner.moduleCache.clear()
      const module = await runner.executeFile(resolvedEntry)

      const res = await env.runModule!(module, ctx.request, {
        viteUrl
      })
      return res
    } catch (e) {
      console.error('Error during evaluation: ', e)
      return new Response(null, { status: 500 })
    }
  })

  hattipServer.on('upgrade', (req, socket, head) => {
    proxyServer.ws(req, socket, head)
  })

  hattipServer.listen(51733, 'localhost', () => {
    console.log('Server listening on http://localhost:51733')
  })
}
