import type { Environment as VitestEnvironment } from 'vitest'
import type { ViteEnvironment } from './types.js'

export const convertToVitestEnvironment = (
  name: string,
  env: (options: Record<string, any>) => ViteEnvironment
): VitestEnvironment => {
  return {
    name: `vite-env-${name}`,
    transformMode: 'web',
    setup() {
      // TODO
      throw new Error("vite-env doesn't support non-VM setup for now")
    },
    async setupVM(options) {
      const result = await env(options).setup()
      return result
    }
  }
}
