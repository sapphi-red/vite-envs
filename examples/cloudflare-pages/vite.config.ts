import { cloudflarePagesRuntimeEnv } from '@vite-runtime/cloudflare-pages'
import { exampleFramework } from 'example-framework'
import { defineConfig } from 'vite'

const cfOptions = {
  miniflareOptions: {
    kvNamespaces: ['FOO_KV'],
    compatibilityFlags: ['global_navigator']
  }
}

export default defineConfig(({ mode }) =>
  mode === 'client'
    ? defineConfig({})
    : defineConfig({
        plugins: [
          cloudflarePagesRuntimeEnv(cfOptions),
          exampleFramework('./_worker.ts')
        ],
        build: {
          ssr: './_worker.ts',
          copyPublicDir: false,
          emptyOutDir: false,
          rollupOptions: {
            output: {
              entryFileNames: '_worker.js'
            }
          }
        },
        resolve: {
          conditions: ['worker', 'workerd']
        },
        ssr: {
          noExternal: true,
          target: 'webworker'
        }
      })
)
