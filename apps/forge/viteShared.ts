import { resolve } from 'node:path';
import { type ViteAlias, weaselAliases } from '../../scripts/vite-aliases.ts';

/** Story globs, relative to the repo root. Shared by the workshop and the `forge-stories` vitest project. */
export const stories = [
  'packages/ui/src/**/*.stories.{ts,tsx}',
  'apps/draw/src/**/*.stories.{ts,tsx}',
  'packages/labkit/src/**/*.stories.{ts,tsx}',
  'packages/forge/src/**/*.stories.{ts,tsx}',
  'packages/diagram/src/**/*.stories.{ts,tsx}',
  'packages/devtools/src/**/*.stories.{ts,tsx}',
];

export const frameConfig = 'apps/forge/forge.frame.tsx';
export const shellConfig = 'apps/forge/forge.shell.tsx';
export const frameStyles = ['apps/forge/frame.css'];

/** The repo's package aliases, with labkit's stylesheet as its build assembles it. */
export function forgeAliases(repoRoot: string): ViteAlias[] {
  return weaselAliases(repoRoot, [
    {
      find: '@weasel-js/labkit/styles.css',
      replacement: resolve(repoRoot, 'apps/forge/labkitStyles.ts'),
    },
  ]);
}
