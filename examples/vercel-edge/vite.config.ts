/// <reference types="@vite-env/core/config" />
/// <reference types="vitest" />
import { vercelEdgeEnv } from '@vite-env/vercel-edge'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) =>
  mode === 'client'
    ? defineConfig({})
    : defineConfig({
        build: {
          ssr: true,
          copyPublicDir: false,
          emptyOutDir: false,
          rollupOptions: {
            input: {
              'api/foo/handler': './api/foo/handler.ts'
            },
          }
        },
        resolve: {
          conditions: ['worker', 'edge-light']
        },
        ssr: {
          environment: vercelEdgeEnv(),
          noExternal: true,
          target: 'webworker',
        },
        test: {
          environment: '@vite-env/vercel-edge',
          experimentalVmThreads: true
        }
      })
)
