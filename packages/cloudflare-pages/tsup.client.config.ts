import { esbuildNoSideEffectPlugin } from '../../scripts/esbuildNoSideEffectPlugin.js'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    client: 'src/client/index.ts'
  },
  format: 'esm',
  noExternal: [/./],
  esbuildPlugins: [esbuildNoSideEffectPlugin(['picomatch'])],
  plugins: [
    {
      name: 'replace-process.env',
      renderChunk(code) {
        if (code.includes('new Proxy(process.env,')) {
          return {
            code: code.replace(
              /new Proxy\(process\.env,/,
              'new Proxy(typeof process !== "undefined" ? process.env : {},'
            )
          }
        }
        return null
      }
    }
  ]
})
