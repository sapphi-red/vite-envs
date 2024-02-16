import type { HMRPayload } from 'vite'
import type { FetchResult } from 'vite/runtime'

export type ClientFunctions = {
  hmrSend(payload: HMRPayload): void;
}

export type ServerFunctions = {
  fetchModule(id: string, importer?: string): Promise<FetchResult>
  hmrSend(payload: HMRPayload): void;
}
