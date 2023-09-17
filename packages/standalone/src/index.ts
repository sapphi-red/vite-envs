import { createServer as createHattipServer } from '@hattip/adapter-node'
import httpProxy from 'http-proxy'
import { setup } from '@vite-env/core'
import { normalizePath } from 'vite'

export const dev = async () => {
  const { viteServer, env, runner } = await setup()
  if (!env.runModule || !env.selectModule) {
    throw new Error('this environment is not supported by vite-env standalone')
  }

  // handle unhandledRejection so that the process won't exit
  process.on('unhandledRejection', (err) => {
    console.log('Unhandled Rejection: ', err)
  })

  await viteServer.listen()
  const viteUrlString =
    viteServer.resolvedUrls!.local[0] ?? viteServer.resolvedUrls!.network[0]
  const viteUrl = new URL(viteUrlString)

  const proxyServer = httpProxy.createProxyServer({
    target: viteUrlString,
    ws: true
  })
  const hattipServer = createHattipServer(async (ctx) => {
    try {
      // TODO: should "page reload" clear all modules on vite-node side?
      runner.moduleCache.clear()

      const resolved = await env.selectModule!(
        ctx.request,
        viteServer.config.root
      )
      if (resolved === undefined) {
        // NOTE: If Vite uses Universal/Modern middlewares in the future,
        //       we can avoid using actual HTTP requests.
        //       It's difficult to convert Node middlewares into them.
        //       https://github.com/fastly/http-compute-js#notes--known-issues
        const newUrl = new URL(ctx.request.url)
        newUrl.protocol = viteUrl.protocol
        newUrl.host = viteUrl.host
        try {
          return await fetch(new Request(newUrl.href, ctx.request))
        } catch (e) {
          console.error('Failed to proxy request to Vite server: ', e)
          return new Response(null, { status: 500 })
        }
      }
      const normalizedResolved = normalizePath(resolved)

      const module = await runner.executeFile(normalizedResolved)

      const res = await env.runModule!(module, ctx.request, {
        viteUrl: viteUrlString
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
