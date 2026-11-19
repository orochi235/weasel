import type { Plugin } from 'esbuild';

export const HARFBUZZ_WASM = 'harfbuzzjs/dist/harfbuzz.wasm';
export const HARFBUZZ_WASM_URL = /^harfbuzzjs\/dist\/harfbuzz\.wasm\?url$/;

/**
 * Builds `import url from 'harfbuzzjs/dist/harfbuzz.wasm?url'` as the URL of a `harfbuzz.wasm` beside the output,
 * where the package build copies it; vite answers the same import itself when it serves the source.
 */
export const wasmUrlPlugin: Plugin = {
  name: 'harfbuzz-wasm-url',
  setup(build) {
    build.onResolve({ filter: HARFBUZZ_WASM_URL }, () => ({ path: HARFBUZZ_WASM, namespace: 'wasm-url' }));
    build.onLoad({ filter: /.*/, namespace: 'wasm-url' }, () => ({
      contents: "export default new URL('./harfbuzz.wasm', import.meta.url).href;",
      loader: 'js',
    }));
  },
};
