import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

export default defineConfig({
  ...packagePreset({
    entry: { index: 'src/index.ts' },
  }),
  // The vendored glue fetches `harfbuzz.wasm` from beside itself outside Node.
  onSuccess: () =>
    copyFile(fileURLToPath(import.meta.resolve('harfbuzzjs/dist/harfbuzz.wasm')), 'dist/harfbuzz.wasm'),
});
