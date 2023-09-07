// TODO: remove node APIs
import { ViteNodeRunner } from 'vite-node/client'
// TODO: remove node APIs
// import { createHotContext } from 'vite-node/hmr'
import { createBirpc } from 'birpc'
import type { ClientFunctions, ServerFunctions } from '../types.js'

declare const __ROOT__: string
declare const __BASE__: string

const ws = new WebSocket('http://localhost:9400')

const clientFunctions: ClientFunctions = {
  executeId(id) {
    runner.executeId(id)
  },
  executeFile(file) {
    runner.executeFile(file)
  }
}

const rpc = createBirpc<ServerFunctions, ClientFunctions>(
  clientFunctions,
  {
    post: data => ws.send(data),
    on: data => ws.addEventListener('message', data),
    serialize: v => JSON.stringify(v),
    deserialize: v => JSON.parse(v),
  },
)

const runner = new ViteNodeRunner({
  root: __ROOT__,
  base: __BASE__,
  fetchModule(id) {
    return rpc.fetchModule(id)
  },
  resolveId(id, importer) {
    return rpc.resolveId(id, importer)
  },
  // createHotContext(runner, url) {
  //   return createHotContext(runner, viteServer.emitter, [], url)
  // },
  unsafeModule: 'workerd:unsafe',
})
await runner.setup()

// provide the vite define variable in this context
await runner.executeId('/@vite/env')


export default {
  fetch(_req: Request) {
    // TODO
    return new Response('res')
  }
}
