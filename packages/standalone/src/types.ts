import type { ViteDevServer } from 'vite'

export type ViteStandaloneRuntime = {
  /**
   * Use the key specified in [Runtime Keys spec](https://runtime-keys.proposal.wintercg.org/)
   *
   * For runtimes not specified in Runtime Keys spec, use a key starting with `x-` (e.g. `x-vite`).
   */
  key: string
  setup(server: ViteDevServer): Promise<ViteStandaloneRuntimeInstance>
}

export type ViteStandaloneRuntimeInstance = {
  runModule: (
    id: string,
    request: Request,
    ctx: RequestContext
  ) => Promise<Response>
  selectModule: (
    request: Request,
    root: string
  ) => string | undefined | Promise<string | undefined>
  teardown(): void | Promise<void>
}

export type RequestContext = {
  viteUrl: string
}
