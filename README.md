# vite-envs

PoC for running Vite's SSR support on emulated environments (e.g. [Edge Runtime](https://edge-runtime.vercel.app/)).

Powered by [Vite Runtime API](https://vitejs.dev/guide/api-vite-runtime.html).

## Features

- Throwing errors when accessing global variables that exist in Node but don't in workers (e.g. `process`, `global`)
- Ability to use worker-only features that are not supported in Node (e.g. Cloudflare KV, `URLPattern`)
- Performant HMR

## How to try this?

```sh
$ pnpm i
$ pnpm -r build
$ cd examples/cloudflare-pages # or other directories in example
$ pnpm dev
```
