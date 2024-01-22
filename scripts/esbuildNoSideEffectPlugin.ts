import type { Plugin } from 'esbuild'

export const esbuildNoSideEffectPlugin = (packageNames: string[]): Plugin => {
  return {
    name: 'no-sideeffect',
    setup({ onResolve, resolve }) {
      onResolve(
        { filter: new RegExp(`^${packageNames.join('|')}$`) },
        async (args) => {
          if (args.pluginData?.skipNoSideEffectResolver) return

          const result = await resolve(args.path, {
            kind: args.kind,
            importer: args.importer,
            namespace: args.namespace,
            resolveDir: args.resolveDir,
            pluginData: { ...args.pluginData, skipNoSideEffectResolver: true }
          })
          return { ...result, sideEffects: false }
        }
      )
    }
  }
}
