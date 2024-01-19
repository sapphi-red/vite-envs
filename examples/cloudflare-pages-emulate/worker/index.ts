import { handleApi } from './api.js'
import type { Env } from './types.js'

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      return await handleApi(request, env, url)
    }
    // Otherwise, serve the static assets.
    // Without this, the Worker will error and no assets will be served.
    return env.ASSETS.fetch(request)
  }
}
