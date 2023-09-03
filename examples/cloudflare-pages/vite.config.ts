/// <reference types="@vite-env/core/config" />
import { cloudflarePagesEnv } from '@vite-env/cloudflare-pages'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) =>
  mode === 'client'
    ? defineConfig({})
    : defineConfig({
        build: {
          ssr: './worker/index.ts',
          copyPublicDir: false,
          emptyOutDir: false,
          rollupOptions: {
            output: {
              entryFileNames: '_worker.js'
            }
          }
        },
        ssr: {
          environment: cloudflarePagesEnv({
            kvNamespaces: ['FOO_KV'],
            compatibilityFlags: ['global_navigator']
          })
        },
      })
)
