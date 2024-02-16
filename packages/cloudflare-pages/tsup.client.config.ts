import { esbuildNoSideEffectPlugin } from '../../scripts/esbuildNoSideEffectPlugin.js'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    client: 'src/client/index.ts'
  },
  format: 'esm',
  noExternal: [/./],
  esbuildPlugins: [esbuildNoSideEffectPlugin(['picomatch'])]
})
