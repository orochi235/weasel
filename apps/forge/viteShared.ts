import { resolve } from 'node:path';
import { type ViteAlias, weaselAliases } from '../../scripts/vite-aliases.ts';

/** Story globs, relative to the repo root. Shared by the workshop and the `forge-stories` vitest project. */
export const stories = [
  'packages/ui/src/**/*.stories.{ts,tsx}',
  'apps/draw/src/**/*.stories.{ts,tsx}',
  'packages/labkit/src/**/*.stories.{ts,tsx}',
];

export const frameConfig = 'apps/forge/forge.frame.tsx';
export const shellConfig = 'apps/forge/forge.shell.tsx';

/** The repo's package aliases, plus the stylesheet entries that only a built package has. */
export function forgeAliases(repoRoot: string): ViteAlias[] {
  return weaselAliases(repoRoot, [
    {
      find: '@weasel-js/theme/tokens.css',
      replacement: resolve(repoRoot, 'packages/theme/src/generated/tokens.css'),
    },
    {
      find: '@weasel-js/theme/fonts.css',
      replacement: resolve(repoRoot, 'packages/theme/src/fonts.css'),
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
