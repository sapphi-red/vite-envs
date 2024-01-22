import { createViteRuntime, type ViteDevServer } from 'vite'
import {
  type ViteRuntimeModuleContext,
  ssrModuleExportsKey,
  ssrImportMetaKey,
  ssrImportKey,
  ssrDynamicImportKey,
  ssrExportAllKey,
  type ResolvedResult,
  type SSRImportMetadata,
  ViteRuntime,
  type ViteModuleRunner
} from 'vite/runtime'
import { EdgeVM } from '@edge-runtime/vm'
import type { ViteStandaloneRuntime } from '@vite-runtime/standalone'
import path from 'node:path'
import fs from 'node:fs'

export const createVercelEdgeRuntime = (
  server: ViteDevServer
): Promise<ViteRuntime> => {
  return createViteRuntime(server, { runner: new VercelEdgeRunner() })
}

class VercelEdgeRunner implements ViteModuleRunner {
  // TODO: wasm import support
  private vm = new EdgeVM({
    // https://vercel.com/docs/functions/edge-functions/edge-runtime#unsupported-apis
    codeGeneration: {
      strings: false,
      wasm: false
    },
    extend(context) {
      context.Buffer = Buffer
      context.process ||= {}
      context.process.env = process.env
      return context
    }
  })

  async runViteModule(
    context: ViteRuntimeModuleContext,
    transformed: string
  ): Promise<any> {
    // TODO: use file name as function name
    const initModule = this.vm.evaluate(
      `(async function(${ssrModuleExportsKey},${ssrImportMetaKey},${ssrImportKey},${ssrDynamicImportKey},${ssrExportAllKey}){"use strict";${transformed}})`
    )
    await initModule(
      context[ssrModuleExportsKey],
      context[ssrImportMetaKey],
      context[ssrImportKey],
      context[ssrDynamicImportKey],
      context[ssrExportAllKey]
    )
    Object.freeze(context[ssrModuleExportsKey])
  }

  runExternalModule(_filepath: string): Promise<any> {
    // TODO: support Node.js modules
    // https://vercel.com/docs/functions/edge-functions/edge-runtime#compatible-node.js-modules
    throw new Error('Not supported')
  }

  processImport(
    mod: Record<string, any>,
    _fetchResult: ResolvedResult,
    _metadata?: SSRImportMetadata | undefined
  ): Record<string, any> {
    return mod
  }
}

export const vercelEdgeStandalone = (): ViteStandaloneRuntime => {
  const extensions = ['ts', 'js', 'mts', 'mjs']

  return {
    key: 'edge-light',
    async setup(server: ViteDevServer) {
      const runtime = await createVercelEdgeRuntime(server)
      return {
        async runModule(id, request) {
          const module = await runtime.executeEntrypoint(id)

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
          const url = new URL(request.url)
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
