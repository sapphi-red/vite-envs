import { type HMRChannel, type HMRPayload } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { WebSocket, WebSocketServer } from 'ws'
import type { ClientFunctions, ServerFunctions } from '../types.js'
import { createBirpc, type BirpcReturn } from 'birpc'
import url from 'node:url'
import { createServer } from 'vite'
import type { TransformResult } from 'vite'

const _dirname = path.dirname(url.fileURLToPath(import.meta.url))
const clientPath = path.resolve(_dirname, './client.js')

export const dev = async () => {
  const viteServer = await createServer({
    plugins: [
      {
        name: 'use-vite-runtime',
        async configureServer(server) {
          const clientContent = await fs.promises.readFile(clientPath, 'utf-8')
          const clientContentReplaced = clientContent.replaceAll(
            '__ROOT__',
            JSON.stringify(server.config.root)
          )

          server.middlewares.use('/@vite/runtime', async (_req, res) => {
            res.setHeader('Content-Type', 'text/javascript')
            res.end(clientContentReplaced)
          })
        },
        transformIndexHtml(html) {
          return html
            .replace(
              /import { injectIntoGlobalHook } from "\/@react-refresh"/,
              'import vite from "/@vite/runtime"; const { injectIntoGlobalHook } = await vite.executeEntrypoint("/@react-refresh")'
            )
            .replace(
              /<script type="module" src="(.+)(?:\?t=\d+)?"><\/script>/g,
              "<script type='module'>import vite from '/@vite/runtime'; vite.executeEntrypoint('$1')</script>"
            )
        }
      }
    ]
  })

  const wss = new WebSocketServer({ host: 'localhost', port: 9400 })

  const hmrChannel = new WssHmrChannel()
  viteServer.hot.addChannel(hmrChannel)

  const serverFunctions: ServerFunctions = {
    async fetchModule(id, importer) {
      id = id.replace(/^file:\/\//, '')
      const resolved = await viteServer.pluginContainer.resolveId(
        id,
        importer,
        { ssr: false }
      )
      if (!resolved) return {}
      const resolvedId = typeof resolved === 'string' ? resolved : resolved.id
      const result = await viteServer.transformRequest(resolvedId, {
        ssr: false
      })
      if (!result) return {}
      const transformed = await viteServer.ssrTransform(
        result.code,
        result.map,
        resolvedId
      )
      return {
        id: resolvedId,
        code: transformed ? inlineSourceMap(transformed, resolvedId).code : undefined
      }
    },
    hmrSend(_payload) {
      // TODO: emit?
    }
  }
  wss.on('connection', (ws) => {
    const rpc = createBirpc<ClientFunctions, ServerFunctions>(serverFunctions, {
      post: (data) => ws.send(data),
      on: (data) => ws.on('message', data),
      serialize: (v) => JSON.stringify(v),
      deserialize: (v) => JSON.parse(v)
    })
    hmrChannel.clients.set(ws, rpc)
    ws.on('close', () => {
      hmrChannel.clients.delete(ws)
    })
  })

  process.once('SIGTERM', async () => {
    try {
      await Promise.allSettled([
        viteServer.close(),
        new Promise<void>((resolve, reject) =>
          wss.close((err) => (err ? reject(err) : resolve()))
        )
      ])
    } finally {
      process.exit()
    }
  })

  // handle unhandledRejection so that the process won't exit
  process.on('unhandledRejection', (err) => {
    console.log('Unhandled Rejection: ', err)
  })

  await viteServer.listen()
  viteServer.printUrls()
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

const AsyncFunction = async function () {}.constructor as typeof Function
const fnDeclarationLineCount = (() => {
  const body = '/*code*/'
  const source = new AsyncFunction('a', 'b', body).toString()
  return source.slice(0, source.indexOf(body)).split('\n').length - 1
})()

function inlineSourceMap(result: TransformResult, id: string) {
  const map = result.map
  let code = result.code

  if (!map) return result

  // this assumes that "new AsyncFunction" is used to create the module
  const moduleSourceMap = Object.assign({}, map, {
    // currently we need to offset the line
    // https://github.com/nodejs/node/issues/43047#issuecomment-1180632750
    mappings: ';'.repeat(fnDeclarationLineCount) + map.mappings,
    sourceRoot: path.posix.dirname(id),
  })

  const sourceMap = Buffer.from(
    JSON.stringify(moduleSourceMap),
    'utf-8'
  ).toString('base64')
  result.code = `${code.trimEnd()}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${sourceMap}\n`

  return result
}
