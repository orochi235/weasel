import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

export default defineConfig(
  packagePreset({
    entry: { index: 'src/index.ts', move: 'src/move.ts', resize: 'src/resize.ts', insert: 'src/insert.ts' },
    external: ['react'],
  }),
);
