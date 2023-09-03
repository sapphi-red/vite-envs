/// <reference types="@vite-env/core/config" />
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
        ssr: {
          environment: vercelEdgeEnv()
        },
      })
)
