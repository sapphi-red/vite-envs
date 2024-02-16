import { vercelEdgeRuntimeEnv } from '@vite-runtime/vercel-edge'
import { exampleFramework } from 'example-framework'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) =>
  mode === 'client'
    ? defineConfig({})
    : defineConfig({
        plugins: [vercelEdgeRuntimeEnv(), exampleFramework('./handler.ts')],
        build: {
          ssr: true,
          copyPublicDir: false,
          emptyOutDir: false,
          rollupOptions: {
            input: './handler.ts'
          }
        },
        resolve: {
          conditions: ['worker', 'edge-light']
        },
        ssr: {
          noExternal: true,
          target: 'webworker'
        }
      })
)
