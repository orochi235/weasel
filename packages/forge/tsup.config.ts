import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

const external = ['react', 'react-dom', 'vite', /^@weasel-js\//, /^virtual:forge\//];

export default defineConfig([
  packagePreset({
    entry: {
      index: 'src/index.ts',
      'vite/index': 'src/vite/index.ts',
      'frame/index': 'src/frame/index.ts',
      'shell/index': 'src/shell/index.ts',
    },
    external,
  }),
  {
    entry: { cli: 'src/cli/cli.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    banner: { js: '#!/usr/bin/env node' },
    external,
    clean: false,
  },
]);
