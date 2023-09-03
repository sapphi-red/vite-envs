import type { ViteEnvironment } from '@vite-env/core'
import { EdgeVM } from '@edge-runtime/vm'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import fs from 'node:fs'

const extensions = ['ts', 'js', 'mts', 'mjs']

export const vercelEdgeEnv = (): ViteEnvironment => {
  return {
    key: 'edge-light',
    async setup() {
      // TODO: Should be possible to support Node.js modules
      // by adding a global variable that accesses the Node.js modules
      // and loading virtual module for Node.js module imports
      // https://vercel.com/docs/functions/edge-functions/edge-runtime#compatible-node.js-modules

      const edgeRuntimeEnv = new EdgeVM({
        extend(context) {
          context.Buffer = Buffer
          context.process ||= {}
          context.process.env = process.env
          return context
        }
      })

      return {
        getVmContext() {
          return edgeRuntimeEnv.context
        },
        async runModule(module, request) {
          // NOTE: doesn't support Edge Middleware
          // https://vercel.com/docs/functions/edge-middleware/middleware-api
          if (!('config' in module)) {
            throw new Error('config export should exist')
          }
          if (!(typeof module.config === 'object' && module.config !== null)) {
            throw new Error('config export should be an object')
          }
          if (
            !('runtime' in module.config && module.config.runtime === 'edge')
          ) {
            throw new Error(
              'config export should have runtime property with a string value "edge"'
            )
          }
          if (!('default' in module)) {
            throw new Error('default export should exist')
          }
          if (!(typeof module.default === 'function')) {
            throw new Error('default export should be a function')
          }

          const context = {
            waitUntil: () => {} // TODO: impl
          }
          return await module.default(request, context)
        },
        selectModule(request, root) {
          const url = new URL(request.url);
          if (url.pathname.startsWith('/api/')) {
            const part = path.resolve(root, `.${url.pathname}/handler`)
            for (const ext of extensions) {
              const p = `${part}.${ext}`
              try {
                const stat = fs.statSync(p, { throwIfNoEntry: false })
                if (stat) {
                  return p
                }
              } catch {}
            }
          }
          return undefined
        },
        teardown() {
          // no-op
        }
      }
    }
  }
}
