import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';
import { HARFBUZZ_WASM, HARFBUZZ_WASM_URL, wasmUrlPlugin } from './wasmUrl.esbuild';

const preset = packagePreset({ entry: { index: 'src/index.ts' } });

export default defineConfig({
  ...preset,
  noExternal: [HARFBUZZ_WASM_URL],
  esbuildPlugins: [...(preset.esbuildPlugins ?? []), wasmUrlPlugin],
  onSuccess: () => copyFile(fileURLToPath(import.meta.resolve(HARFBUZZ_WASM)), 'dist/harfbuzz.wasm'),
});
