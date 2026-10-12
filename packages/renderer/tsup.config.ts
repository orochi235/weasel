import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

export default defineConfig(
  packagePreset({
    entry: {
      index: 'src/index.ts',
      mesh: 'src/mesh.ts',
      'patterns-builtin': 'src/patterns-builtin.ts',
      'testing/glRecorder': 'src/testing/glRecorder.ts',
      'testing/vertexUploads': 'src/testing/vertexUploads.ts',
      'test-seams': 'src/test-seams.ts',
    },
  }),
);
