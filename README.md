# vite-envs

PoC for running Vite's SSR support on emulated environments (e.g. [Edge Runtime](https://edge-runtime.vercel.app/)).

Powered by [vite-node](https://github.com/vitest-dev/vitest/tree/main/packages/vite-node) ([vite-node will be merged into Vite in the future](https://github.com/vitejs/vite/pull/12165)).

Because both this and [Vitest](https://vitest.dev/) use vite-node, these environments would be possible to use with Vitest.

## Features

- Throwing errors when accessing global variables that exist in Node but don't in workers (e.g. `process`, `global`)
- Ability to use worker-only features that are not supported in Node (e.g. Cloudflare KV, `URLPattern`)
- Performant HMR

## What is out of scope?

- build configurations (could include in the future)
