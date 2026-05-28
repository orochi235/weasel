import type { StorybookConfig } from '@storybook/react-vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';
import { weaselAliases } from '../scripts/vite-aliases.ts';
import { weaselTokensPlugin } from '../scripts/vite-plugin-weasel-tokens.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// One Storybook instance for the whole repo. Stories live next to their
// components in both `packages/weasel-ui/` (kit UI primitives) and
// `apps/swillustrator/` (app-specific surfaces). Sidebar partitioning is
// driven by each story's CSF `title`: `weasel-ui/...` vs `swillustrator/...`.
const config: StorybookConfig = {
  stories: [
    '../packages/weasel-ui/src/**/*.stories.@(ts|tsx)',
    '../apps/swillustrator/src/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
    // Local addon: CSS Vars panel — see `.storybook/addons/css-vars/`.
    './addons/css-vars/preset.ts',
  ],
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
        alias: weaselAliases(repoRoot, [
          // weasel-theme ships a `tokens.css` import — the generic wildcard
          // would otherwise rewrite the `.css` suffix to a `.ts` lookup.
          {
            find: '@orochi235/weasel-theme/tokens.css',
            replacement: resolve(repoRoot, 'packages/weasel-theme/src/tokens.css'),
          },
        ]),
      },
      plugins: [weaselTokensPlugin({ repoRoot })],
    });
  },
};

export default config;
