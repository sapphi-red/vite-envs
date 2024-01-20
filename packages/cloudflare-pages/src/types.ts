import type { FetchResult } from 'vite/runtime'

export type ClientFunctions = {}

export type ServerFunctions = {
  fetchModule(id: string, importer?: string): Promise<FetchResult>
}
