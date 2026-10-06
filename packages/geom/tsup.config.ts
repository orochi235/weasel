import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

export default defineConfig(
  packagePreset({
    entry: {
      index: 'src/index.ts',
      'booleans/index': 'src/booleans/index.ts',
      '3d/index': 'src/3d/index.ts',
      'nd/index': 'src/nd/index.ts',
      'curves/index': 'src/curves/index.ts',
      'tessellate/index': 'src/tessellate/index.ts',
    },
  }),
);
