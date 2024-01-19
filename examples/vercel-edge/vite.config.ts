/// <reference types="@vite-runtime/standalone/config" />
import { vercelEdgeStandalone } from '@vite-runtime/vercel-edge'
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
          runtime: vercelEdgeStandalone(),
          noExternal: true,
          target: 'webworker',
        }
      })
)
