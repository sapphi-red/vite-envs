import type { FetchResult, ViteNodeResolveId } from 'vite-node'

export type ClientFunctions = {
  executeId(id: string): void
  executeFile(file: string): void
}

export type ServerFunctions = {
  fetchModule(id: string): Promise<FetchResult>
  resolveId(
    id: string,
    importer?: string
  ): Promise<ViteNodeResolveId | null | undefined | void>
}
