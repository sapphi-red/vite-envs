import { type ViteDevServer } from 'vite'
import type { ViteStandaloneRuntime } from '@vite-runtime/standalone'
import path from 'node:path'
import fs from 'node:fs'
import { Miniflare, type SharedOptions, Request, Response } from 'miniflare'
import { WebSocketServer } from 'ws'
import type { ClientFunctions, ServerFunctions } from '../types.js'
import { createBirpc } from 'birpc'
import url from 'node:url'

const _dirname = path.dirname(url.fileURLToPath(import.meta.url))
const clientPath = path.resolve(_dirname, './client.js')

type Options = {
  miniflareOptions?: Omit<SharedOptions & WorkerOptions, 'script' | 'modules'>
}

export const cloudflareStandalone = (
  options: Options = {}
): ViteStandaloneRuntime => {
  const extensions = ['ts', 'js', 'mts', 'mjs']
  let mf: Miniflare

  return {
    key: 'workerd',
    async setup(server: ViteDevServer) {
      const clientContent = await fs.promises.readFile(clientPath, 'utf-8')
      const clientContentReplaced = clientContent.replaceAll(
        '__ROOT__',
        JSON.stringify(server.config.root)
      )

      mf = new Miniflare({
        ...options.miniflareOptions,
        script: clientContentReplaced,
        scriptPath: path.join(server.config.root, '_virtual_worker_entry.js'),
        modules: true,
        unsafeEvalBinding: 'UNSAFE_EVAL',
        serviceBindings: {
          ASSETS: async (req: Request) => {
            const viteUrlString =
              server.resolvedUrls!.local[0] ?? server.resolvedUrls!.network[0]
            const viteUrl = new URL(viteUrlString)

            const newUrl = new URL(req.url)
            newUrl.protocol = viteUrl.protocol
            newUrl.host = viteUrl.host
            try {
              const res = await fetch(
                new globalThis.Request(
                  newUrl.href,
                  req as unknown as globalThis.Request
                )
              )
              return new Response(
                res.body ? await res.arrayBuffer() : undefined,
                {
                  headers: Object.fromEntries(
                    res.headers as unknown as Iterable<[string, string]>
                  ),
                  status: res.status,
                  statusText: res.statusText
                }
              )
            } catch (e) {
              console.error('Failed to execute ASSETS.fetch: ', e)
              return new Response(null, { status: 500 })
            }
          }
        }
      })
      const url = await mf.ready

      const wss = new WebSocketServer({ host: 'localhost', port: 9400 })

      const serverFunctions: ServerFunctions = {
        fetchModule(id) {
          return server.ssrFetchModule(id)
        }
      }
      wss.on('connection', (ws) => {
        createBirpc<ClientFunctions, ServerFunctions>(serverFunctions, {
          post: (data) => ws.send(data),
          on: (data) => ws.on('message', data),
          serialize: (v) => JSON.stringify(v),
          deserialize: (v) => JSON.parse(v)
        })
      })

      return {
        async runModule(id, request) {
          const resolvedUrl = new URL(request.url)
          resolvedUrl.protocol = url.protocol
          resolvedUrl.host = url.host
          request.headers.set('vite-runtime-execute-url', id)
          const body = request.body ? await request.arrayBuffer() : undefined
          const response = await mf.dispatchFetch(resolvedUrl, {
            method: request.method,
            headers: Object.fromEntries(
              request.headers as unknown as Iterable<[string, string]>
            ),
            body
          })
          return response as unknown as globalThis.Response
        },
        // TODO: support non-Advanced mode
        selectModule(_request, root) {
          for (const ext of extensions) {
            const p = path.resolve(root, `_worker.${ext}`)
            try {
              const stat = fs.statSync(p, { throwIfNoEntry: false })
              if (stat) {
                return p
              }
            } catch {}
          }
          return undefined
        },
        async teardown() {
          await mf.dispose()
          await new Promise<void>((resolve, reject) =>
            wss.close((err) => (err ? reject(err) : resolve()))
          )
        }
      }
    }
  }
}
