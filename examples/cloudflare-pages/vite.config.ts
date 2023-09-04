/// <reference types="@vite-env/core/config" />
/// <reference types="vitest" />
import { cloudflarePagesEnv } from '@vite-env/cloudflare-pages'
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
          conditions: ['workerd']
        },
        ssr: {
          environment: cloudflarePagesEnv(cfOptions),
          noExternal: true,
          target: 'webworker',
        },
        test: {
          environment: '@vite-env/cloudflare-pages',
          environmentOptions: { ...cfOptions, enableGlobalBindings: true },
          experimentalVmThreads: true
        }
      })
)
