import { KVNamespace } from '@cloudflare/workers-types'

type Env = {
  ASSETS: {
    fetch: typeof fetch
  }
  FOO_KV: KVNamespace
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/kv') {
        if (request.method === 'GET') {
          const result = await env.FOO_KV.get('foo')
          if (result === null) {
            return new Response(null, { status: 404 })
          }
          return new Response(result)
        } else if (request.method === 'POST') {
          const body = await request.text()
          await env.FOO_KV.put('foo', body)
          return new Response(null, { status: 204 })
        }
      }

      return new Response('Ok')
    }
    // Otherwise, serve the static assets.
    // Without this, the Worker will error and no assets will be served.
    return env.ASSETS.fetch(request)
  }
}
