/**
 * Changes that reach tests with no import edge to follow, `vitest.config.ts` and what it loads among
 * them: a branch changing any of these runs everything (`branchChanges` in `fleet-tree.mjs`).
 */
export const TRIGGERS = [
  '**/package.json',
  'package-lock.json',
  '**/tsconfig*.json',
  '.onto/tests',
  '**/{vitest,vite}.config.*',
  'vitest.*setup.ts',
  'packages/labkit/src/test-setup.ts',
  'scripts/*.setup.ts',
  'scripts/{vite,vitest}-*.{ts,mjs}',
  'scripts/chromium-gpu-args.ts',
  'scripts/headless-source.ts',
  'scripts/lib/**',
  'scripts/release/**',
  'typedoc/packageOptions.mjs',
  'apps/draw/vite-plugin-*{.ts,/**}',
  'apps/forge/viteShared.ts',
  'packages/forge/src/vite/**',
  'packages/icons-plugin/**',
];

/**
 * The triggers one workspace or app owns: a branch changing one runs that package's tests and its
 * dependents' instead of everything. No config here loads them; the root and `packages/` ones stay global.
 */
export const SCOPED = ['packages/*/package.json', 'packages/*/tsconfig*.json', '{packages,apps}/*/{vitest,vite}.config.*', 'apps/*/tsconfig*.json'];
