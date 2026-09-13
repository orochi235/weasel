import { resolve } from 'node:path';
import { type ViteAlias, weaselAliases } from '../../scripts/vite-aliases';

/** Story globs, relative to the repo root. Shared by the workshop and the `forge-stories` vitest project. */
export const stories = [
  'apps/forge/stories/**/*.stories.{ts,tsx}',
  'packages/ui/src/**/*.stories.{ts,tsx}',
  'apps/draw/src/**/*.stories.{ts,tsx}',
  'packages/labkit/src/**/*.stories.{ts,tsx}',
];

export const forgeConfig = 'apps/forge/forge.config.tsx';

/** The repo's package aliases, plus the stylesheet entries that only a built package has. */
export function forgeAliases(repoRoot: string): ViteAlias[] {
  return weaselAliases(repoRoot, [
    {
      find: '@weasel-js/theme/tokens.css',
      replacement: resolve(repoRoot, 'packages/theme/src/generated/tokens.css'),
    },
    {
      find: '@weasel-js/labkit/styles.css',
      replacement: resolve(repoRoot, 'apps/forge/labkitStyles.ts'),
    },
    {
      find: '@weasel-js/forge/shell.css',
      replacement: resolve(repoRoot, 'packages/forge/src/shell/shell.css'),
    },
    {
      find: '@weasel-js/forge/frame.css',
      replacement: resolve(repoRoot, 'packages/forge/src/frame/frame.css'),
    },
  ]);
}
