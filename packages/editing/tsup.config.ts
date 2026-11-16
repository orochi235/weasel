import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

// Declarations only; the JavaScript comes from `vite.config.ts`, which runs first and empties `dist/`.
export default defineConfig({ ...packagePreset({ entry: { index: 'src/index.ts' } }), dts: { only: true }, clean: false });
