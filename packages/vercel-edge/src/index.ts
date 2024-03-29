import { createViteRuntime, type Plugin } from 'vite'
import {
  type ViteRuntimeModuleContext,
  ssrModuleExportsKey,
  ssrImportMetaKey,
  ssrImportKey,
  ssrDynamicImportKey,
  ssrExportAllKey,
  type ViteModuleRunner
} from 'vite/runtime'
import { EdgeVM } from '@edge-runtime/vm'
import { makeLegalIdentifier } from '@rollup/pluginutils'
import type { ViteEnvApi } from '@vite-runtime/types'

export const vercelEdgeRuntimeEnv = (): Plugin<ViteEnvApi> => {
  return {
    name: 'vite-env:vercel-edge',
    api: {
      async createRuntime(server) {
        const runtime = await createViteRuntime(server, {
          runner: new VercelEdgeRunner()
        })
        return {
          executeUrl(url) {
            return runtime.executeUrl(url)
          },
          executeEntrypoint(url) {
            return runtime.executeEntrypoint(url)
          },
          async dispatchRequest(moduleUrl, request) {
            const module = await runtime.executeEntrypoint(moduleUrl)

            // NOTE: doesn't support Edge Middleware
            // https://vercel.com/docs/functions/edge-middleware/middleware-api
            if (!('config' in module)) {
              throw new Error('config export should exist')
            }
            if (
              !(typeof module.config === 'object' && module.config !== null)
            ) {
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
          }
        }
      }
    }
  }
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
    code: string,
    id: string
  ): Promise<any> {
    // @ts-expect-error import.meta.filename doesn't exist
    delete context[ssrImportMetaKey].filename
    // @ts-expect-error import.meta.dirname doesn't exist
    delete context[ssrImportMetaKey].dirname

    const funcName = makeLegalIdentifier(id)
    const initModule = this.vm.evaluate(
      `(async function ${funcName}(${ssrModuleExportsKey},${ssrImportMetaKey},${ssrImportKey},${ssrDynamicImportKey},${ssrExportAllKey}){"use strict";${code}})`
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
}
