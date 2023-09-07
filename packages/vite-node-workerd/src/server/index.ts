import { createServer } from 'vite'
import { ViteNodeServer } from 'vite-node/server'
import { viteNodeHmrPlugin } from 'vite-node/hmr'
import { installSourcemapsSupport } from 'vite-node/source-map'
import { Miniflare } from 'miniflare'
import { createServer as createHattipServer } from '@hattip/adapter-node'
import httpProxy from 'http-proxy'
import fs from 'node:fs/promises'
import url from 'node:url'
import path from 'node:path'
import { WebSocketServer } from 'ws'
import type { ClientFunctions, ServerFunctions } from '../types.js'
import { createBirpc } from 'birpc'

const _dirname = path.dirname(url.fileURLToPath(import.meta.url))
const clientPath = path.resolve(_dirname, './client.js')

export const setup = async () => {
  const inlineConfig = {
    plugins: [viteNodeHmrPlugin()],
    optimizeDeps: {
      disabled: true
    }
  }

  const wss = new WebSocketServer({ host: 'localhost', port: 9400 })
  const serverFunctions: ServerFunctions = {
    fetchModule(id) {
      return node.fetchModule(id)
    },
    resolveId(id, importer) {
      return node.resolveId(id, importer)
    }
  }
  wss.on('connection', ws => {
    createBirpc<ClientFunctions, ServerFunctions>(serverFunctions, {
      post: (data) => ws.send(data),
      on: (data) => ws.on('message', data),
      serialize: (v) => JSON.stringify(v),
      deserialize: (v) => JSON.parse(v)
    })
  })

  const viteServer = await createServer(inlineConfig)

  const clientContent = await fs.readFile(clientPath, 'utf-8')
  const clientContentReplaced = clientContent
    .replaceAll('__ROOT__', JSON.stringify(viteServer.config.root))
    .replaceAll('__BASE__', JSON.stringify(viteServer.config.base))

  const mf = new Miniflare({
    script: clientContentReplaced,
    modules: true,
    compatibilityFlags: ['unsafe']
  })

  process.once('SIGTERM', async () => {
    try {
      wss.close()
      await Promise.allSettled([viteServer.close(), mf.dispose()])
    } finally {
      process.exit()
    }
  })

  await viteServer.pluginContainer.buildStart({})

  const node = new ViteNodeServer(viteServer)

  installSourcemapsSupport({
    getSourceMap: (source) => node.getSourceMap(source)
  })

  const runner = {
    // TODO: communicate
    request(_path: string) {
      // TODO: use path?
      return mf.dispatchFetch('http://localhost/')
    },
    clearModuleCache() {
      // TODO: should "page reload" clear all modules on vite-node side?
      // runner.moduleCache.clear()
    }
  }

  return { viteServer, runner }
}

export const dev = async () => {
  const { viteServer, runner } = await setup()

  // handle unhandledRejection so that the process won't exit
  process.on('unhandledRejection', (err) => {
    console.log('Unhandled Rejection: ', err)
  })

  await viteServer.listen()
  const viteUrlString =
    viteServer.resolvedUrls!.local[0] ?? viteServer.resolvedUrls!.network[0]

  const proxyServer = httpProxy.createProxyServer({
    target: viteUrlString,
    ws: true
  })
  const hattipServer = createHattipServer(async (_ctx) => {
    try {
      const entry = '_worker.js'
      // @ts-expect-error TODO
      const res: Response = await runner.request(entry)
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
