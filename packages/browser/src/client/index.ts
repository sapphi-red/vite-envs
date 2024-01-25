import {
  ViteRuntime,
  type HMRRuntimeConnection,
  ESModulesRunner
} from 'vite/runtime'
import { createBirpc } from 'birpc'
import type { ClientFunctions, ServerFunctions } from '../types.js'
import type { HMRPayload } from 'vite'

declare const __ROOT__: string

const ws = new WebSocket('ws://localhost:9400')
const connectionPromise = new Promise<void>((resolve) => {
  ws.addEventListener(
    'open',
    () => {
      resolve()
    },
    { once: true }
  )
})

const clientFunctions: ClientFunctions = {
  hmrSend(payload) {
    onHmrRecieve?.(payload)
  }
}
const rpc = createBirpc<ServerFunctions, ClientFunctions>(clientFunctions, {
  post: async (data) => {
    await connectionPromise
    ws.send(data)
  },
  on: (data) => ws.addEventListener('message', (e) => data(e.data)),
  serialize: (v) => JSON.stringify(v),
  deserialize: (v) => JSON.parse(v)
})

let onHmrRecieve: ((payload: HMRPayload) => void) | undefined

const hmrConnection: HMRRuntimeConnection = {
  isReady() {
    return ws.readyState === ws.OPEN
  },
  send(messages: string) {
    console.log('send:', messages)
  },
  onUpdate(h: any) {
    onHmrRecieve = h
    return () => {
      onHmrRecieve = undefined
    }
  }
}

const vite = new ViteRuntime(
  {
    root: __ROOT__,
    fetchModule: (id, importer) => rpc.fetchModule(id, importer),
    hmr: {
      connection: hmrConnection
    }
  },
  new ESModulesRunner()
)

export default vite
