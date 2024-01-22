/// <reference path="./config.ts" />
import { createServer as createHattipServer } from '@hattip/adapter-node'
import httpProxy from 'http-proxy'
import { createServer } from 'vite'

export type { ViteStandaloneRuntime } from './types.js'

export const dev = async () => {
  const viteServer = await createServer()
  process.once('SIGTERM', async () => {
    try {
      await viteServer.close()
    } finally {
      process.exit()
    }
  })

  const runtimeWithInfo = viteServer.config.ssr.runtime
  if (!runtimeWithInfo) {
    throw new Error('ssr.runtime is required for vite-runtime-standalone')
  }
  const standaloneRuntime = await runtimeWithInfo.setup(viteServer)

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
      const resolved = await standaloneRuntime.selectModule!(
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
      const res = await standaloneRuntime.runModule!(
        resolved,
        ctx.request,
        {
          viteUrl: viteUrlString
        }
      )
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
