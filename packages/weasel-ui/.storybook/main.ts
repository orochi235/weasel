import type { StorybookConfig } from '@storybook/react-vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
  async viteFinal(viteConfig) {
    return mergeConfig(viteConfig, {
      resolve: {
        alias: [
          {
            find: '@orochi235/weasel-theme/tokens.css',
            replacement: resolve(repoRoot, 'packages/weasel-theme/src/tokens.css'),
          },
          {
            find: '@orochi235/weasel-theme',
            replacement: resolve(repoRoot, 'packages/weasel-theme/src/index.ts'),
          },
          {
            find: /^@orochi235\/weasel-ui\/(.*)$/,
            replacement: resolve(repoRoot, 'packages/weasel-ui/src/$1'),
          },
          {
            find: '@orochi235/weasel-ui',
            replacement: resolve(repoRoot, 'packages/weasel-ui/src/index.ts'),
          },
        ],
      },
    });
  },
};

export default config;
