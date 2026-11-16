import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

export default defineConfig(packagePreset({
  entry: { index: 'src/index.ts', react: 'src/react.ts', mesh: 'src/mesh.ts', 'icons.table': 'src/icons.table.ts', 'test-seams': 'src/test-seams.ts' },
}));
