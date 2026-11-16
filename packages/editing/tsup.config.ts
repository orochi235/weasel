import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

// Declarations only; the JavaScript comes from `vite.config.ts`, which runs first and empties `dist/`.
export default defineConfig({ ...packagePreset({ entry: { index: 'src/index.ts', engine: 'src/engine.ts', 'test-seams': 'src/test-seams.ts', 'icons.table': 'src/icons.table.ts' } }), dts: { only: true }, clean: false });
