/// <reference types="@vite-runtime/standalone/config" />
import { cloudflareStandalone } from '@vite-runtime/cloudflare-pages-emulate'
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
          runtime: cloudflareStandalone(cfOptions),
          noExternal: true,
          target: 'webworker',
        }
      })
)
