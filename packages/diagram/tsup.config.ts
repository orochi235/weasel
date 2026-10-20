import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

export default defineConfig(
  packagePreset({ entry: { index: 'src/index.ts', layout: 'src/layout.entry.ts', effect: 'src/effect.entry.ts', 'icons.table': 'src/icons.table.ts' }, external: ['react'] }),
);
