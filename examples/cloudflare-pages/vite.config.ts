/// <reference types="@vite-env/core/config" />
import { cloudflarePagesEnv } from "@vite-env/cloudflare-pages"
import { defineConfig } from "vite"

export default defineConfig({
  ssr: {
    environment: cloudflarePagesEnv({
      kvNamespaces: ['FOO_KV']
    })
  }
})
