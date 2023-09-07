import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    client: 'src/client/index.ts'
  },
  format: 'esm',
  noExternal: [/^(?!workerd:)./],
  external: [/^workerd:.*/]
})
