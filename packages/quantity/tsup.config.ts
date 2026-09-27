import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

export default defineConfig(packagePreset({ entry: { index: 'src/index.ts' } }));
