// need import for augmentation but don't want to import actual module
import type {} from 'vite'
import type { ViteEnvironment } from './types.js'

declare module 'vite' {
  interface SSROptions {
    environment?: ViteEnvironment
  }
}
