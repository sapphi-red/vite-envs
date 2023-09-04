# vite-envs

PoC for running Vite's SSR support on emulated environments (e.g. [Edge Runtime](https://edge-runtime.vercel.app/)).

Powered by [vite-node](https://github.com/vitest-dev/vitest/tree/main/packages/vite-node) ([vite-node will be merged into Vite in the future](https://github.com/vitejs/vite/pull/12165)).

Because both this and [Vitest](https://vitest.dev/) use vite-node, these environments are possible to use with Vitest.

## Features

- Throwing errors when accessing global variables that exist in Node but don't in workers (e.g. `process`, `global`)
- Ability to use worker-only features that are not supported in Node (e.g. Cloudflare KV, `URLPattern`)
- Performant HMR
- Vitest support

## What are out of scope?

- build configurations (using `ssr.environment` won't change any them)

## How to try this?

```sh
$ pnpm i
$ pnpm build:packages
$ cd examples/cloudflare-pages # or other directories in example
$ pnpm dev # or pnpm build
```
