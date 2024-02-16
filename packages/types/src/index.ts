import type { ViteDevServer } from 'vite'

export type ViteEnvApi = {
  createRuntime: (server: ViteDevServer) => Promise<ViteRuntimeEnv>
}

export type ViteRuntimeEnv =
  | {
      executeUrl: (url: string) => Promise<unknown>
      executeEntrypoint: (url: string) => Promise<unknown>

      dispatchRequest?: (
        moduleUrl: string,
        request: Request
      ) => Promise<Response>

      teardown?: () => void | Promise<void>
    }
  | {
      executeUrl?: (url: string) => Promise<unknown>
      executeEntrypoint?: (url: string) => Promise<unknown>

      dispatchRequest: (
        moduleUrl: string,
        request: Request
      ) => Promise<Response>

      teardown?: () => void | Promise<void>
    }
