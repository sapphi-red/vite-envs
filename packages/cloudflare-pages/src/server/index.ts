import {
  type HMRChannel,
  type HMRPayload,
  fetchModule,
  type Plugin
} from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import {
  Miniflare,
  type SharedOptions,
  type WorkerOptions,
  Request,
  Response
} from 'miniflare'
import { WebSocket, WebSocketServer } from 'ws'
import type { ClientFunctions, ServerFunctions } from '../types.js'
import { createBirpc, type BirpcReturn } from 'birpc'
import url from 'node:url'
import type { ViteEnvApi } from '@vite-runtime/types'

const _dirname = path.dirname(url.fileURLToPath(import.meta.url))
const clientPath = path.resolve(_dirname, './client.js')

type Options = {
  miniflareOptions?: Omit<SharedOptions & WorkerOptions, 'script' | 'modules'>
}

export const cloudflarePagesRuntimeEnv = (
  options: Options = {}
): Plugin<ViteEnvApi> => {
  const hmrChannel = new WssHmrChannel()

  return {
    name: 'vite-env:workerd',
    configureServer: {
      order: 'pre',
      handler(server) {
        server.hot.addChannel(hmrChannel)
      }
    },
    api: {
      async createRuntime(server) {
        const clientContent = await fs.promises.readFile(clientPath, 'utf-8')
        const clientContentReplaced = clientContent.replaceAll(
          '__ROOT__',
          JSON.stringify(server.config.root)
        )

        const mf = new Miniflare({
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

        const wss = new WebSocketServer({ host: 'localhost', port: 9400 })
        const serverFunctions: ServerFunctions = {
          fetchModule(id, importer) {
            return fetchModule(server, id, importer)
          },
          hmrSend(_payload) {
            // TODO: emit?
          }
        }
        wss.on('connection', (ws) => {
          const rpc = createBirpc<ClientFunctions, ServerFunctions>(
            serverFunctions,
            {
              post: (data) => ws.send(data),
              on: (data) => ws.on('message', data),
              serialize: (v) => JSON.stringify(v),
              deserialize: (v) => JSON.parse(v)
            }
          )
          hmrChannel.clients.set(ws, rpc)
          ws.on('close', () => {
            hmrChannel.clients.delete(ws)
          })
        })

        return {
          async dispatchRequest(moduleUrl, request) {
            request.headers.set('vite-runtime-execute-url', moduleUrl)
            const body = request.body ? await request.arrayBuffer() : undefined
            const response = await mf.dispatchFetch(request.url, {
              method: request.method,
              headers: Object.fromEntries(
                request.headers as unknown as Iterable<[string, string]>
              ),
              body
            })
            return response as unknown as globalThis.Response
          },
          async teardown() {
            await Promise.all([
              mf.dispose(),
              new Promise<void>((resolve, reject) =>
                wss.close((err) => (err ? reject(err) : resolve()))
              )
            ])
          }
        }
      }
    }
  }
}

class WssHmrChannel implements HMRChannel {
  name = 'WssHmrChannel'
  clients = new Map<WebSocket, BirpcReturn<ClientFunctions, ServerFunctions>>()

  listen(): void {}
  close(): void {}

  on(_event: unknown, _listener: unknown): void {}
  off(_event: string, _listener: Function): void {}

  send(arg0: unknown, arg1?: unknown): void {
    let payload: HMRPayload
    if (typeof arg0 === 'string') {
      payload = {
        type: 'custom',
        event: arg0,
        data: arg1
      }
    } else {
      payload = arg0 as HMRPayload
    }

    this.clients.forEach((rpc) => {
      rpc.hmrSend(payload)
    })
  }
}
