import type { KVNamespace } from '@cloudflare/workers-types'

export type Env = {
  ASSETS: {
    fetch: typeof fetch
  }
  FOO_KV: KVNamespace
}
