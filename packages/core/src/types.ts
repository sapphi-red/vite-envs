export type ViteEnvironment = {
  setup(): Promise<ViteEnvironmentInfo>
}

export type ViteEnvironmentInfo = {
  getVmContext: () => Record<string, unknown>
  runModule?: (module: Record<string, unknown>, request: Request, ctx: RequestContext) => Promise<Response>
  teardown(): void | Promise<void>
}

export type RequestContext = {
  viteUrl: string
}
