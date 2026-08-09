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
            find: '@weasel-js/theme/tokens.css',
            replacement: resolve(repoRoot, 'packages/theme/src/generated/tokens.css'),
          },
          {
            find: '@weasel-js/theme',
            replacement: resolve(repoRoot, 'packages/theme/src/index.ts'),
          },
          {
            find: /^@weasel-js\/ui\/(.*)$/,
            replacement: resolve(repoRoot, 'packages/ui/src/$1'),
          },
          {
            find: '@weasel-js/ui',
            replacement: resolve(repoRoot, 'packages/ui/src/index.ts'),
          },
        ],
      },
    });
  },
};

export default config;
