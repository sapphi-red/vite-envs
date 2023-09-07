This branch tries to run vite-node client on the actual environment for Cloudflare Workers (workerd).

It seems vite-node client uses Node buildin modules for much more places than I expected.

This doesn't work yet but I guess it's possible to make it work.

## What I did

- Added `workerd:unsafe` to workerd when compatibilityFlag `unsafe` is included
  - That module's default export has a `runInEvalAllowedContext` function that allows you to run `eval` and other alternatives inside the callback function.
  - `overrides/workerd-*` contains the built workerd that [I patched](https://github.com/sapphi-red/workerd/commit/fafb525c1da2abbc5ec2335358223b18928b6f60)
    - I don't have a M1 machine and wasn't able to compile the ARM versions, so those don't contain the built binary.
- Use `runInEvalAllowedContext` + `new AsyncFunction` instead of `vm.runInContext` in `vite-node/client`
- Communication between the Node Server and the module inside Workerd

See `packages/vite-node-workerd`

---

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
