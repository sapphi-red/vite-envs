import type { Env } from './types.js'

export const handleApi = async (request: Request, env: Env, url: URL) => {
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
  if (url.pathname === '/api/error') {
    const error = new Error('Stacktrace')
    return new Response(error.stack)
  }

  return new Response(`404 (${navigator.userAgent})`, { status: 404 })
}
