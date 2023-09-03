export type ViteEnvironment = {
  setup(): Promise<ViteEnvironmentInfo>
}

export type ViteEnvironmentInfo = {
  getVmContext: () => Record<string, unknown>
  runModule?: (module: Record<string, unknown>, request: Request) => Promise<Response>
  teardown(): void | Promise<void>
}
