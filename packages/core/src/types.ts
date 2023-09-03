export type ViteEnvironment = {
  /**
   * Use the key specified in [Runtime Keys spec](https://runtime-keys.proposal.wintercg.org/)
   *
   * For runtimes not specified in Runtime Keys spec, use a key starting with `x-` (e.g. `x-vite`).
   */
  key: string
  setup(): Promise<ViteEnvironmentInfo>
  /** support non-VM env for Vitest */
  // setup(): Promise<>
}

export type ViteEnvironmentInfo = {
  getVmContext: () => Record<string, unknown>
  runModule?: (module: Record<string, unknown>, request: Request, ctx: RequestContext) => Promise<Response>
  selectModule?: (request: Request, root: string) => string | undefined | Promise<string | undefined>
  teardown(): void | Promise<void>
}

export type RequestContext = {
  viteUrl: string
}
