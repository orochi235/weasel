import { readFileSync } from 'node:fs';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Core's internal path aliases, read off the root tsconfig rather than
 * hand-listed. Every package whose tsconfig extends root without overriding
 * `paths` resolves all of them, so every one is a reach-back a leaf-purity
 * rule has to catch. Hand-listing is how you end up checking five of seven.
 */
const CORE_ALIASES = (() => {
  const raw = readFileSync(new URL('./tsconfig.json', import.meta.url), 'utf8')
    .replace(/^\s*\/\/.*$/gm, ''); // tsconfig allows comments; JSON.parse does not
  return Object.keys(JSON.parse(raw).compilerOptions.paths)
    .filter((k) => k.endsWith('/*') && !k.startsWith('@'));
})();

/**
 * Minimal ESLint flat config — architectural boundaries only.
 *
 * No style rules, no type-aware rules: `tsc --noEmit` covers types and nothing
 * here should have an opinion about formatting. What's left is the dependency
 * arrows the type system can't express.
 *
 * `@typescript-eslint` and `react-hooks` are registered but have every rule
 * off. They're here so the `eslint-disable` comments already scattered through
 * the tree naming their rules resolve instead of erroring — turning either
 * plugin on is a separate decision with its own backlog.
 */

const languageOptions = {
  parser: tsParser,
  ecmaVersion: 2023,
  sourceType: 'module',
  parserOptions: { ecmaFeatures: { jsx: true } },
};

const plugins = { '@typescript-eslint': tsPlugin, 'react-hooks': reactHooks };

export default [
  {
    ignores: [
      '**/dist/**',
      '**/dist-*/**',
      '**/node_modules/**',
      '**/storybook-static/**',
      '**/*.d.ts',
    ],
  },
  {
    // Most `eslint-disable` comments in the tree name rules we don't run, so
    // every one of them would report as unused. The directives are load-bearing
    // for editors and for whoever turns those plugins on.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  {
    /**
     * `core/` is the bottom of the package: scene, ops, adapters, selection,
     * viewport. `features/` and `interactions/` build on it, never the reverse.
     * A runtime reach-back is a cycle, which the bundler resolves by
     * duplicating a module — and a duplicated registry is a silent, total
     * failure rather than a loud one.
     *
     * The arrow holds for type imports too: core named three upper-layer types
     * (`Path`, `RectPose`, `ModifierState`) until 2026-08-08, when they moved
     * down to `core/geometry/path.ts`, `core/scene/types.ts` and
     * `core/modifierState.ts` with re-exports left at their old addresses. An
     * erased import can't form the bundler cycle this rule mainly guards, but
     * nothing needs the exemption now, so it isn't granted.
     */
    files: ['packages/core/src/core/**/*.{ts,tsx}'],
    languageOptions,
    plugins,
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['features/*', 'interactions/*', '**/features/**', '**/interactions/**'],
              message:
                'core/ must not import from features/ or interactions/. Dependencies flow one way.',
            },
          ],
        },
      ],
    },
  },
  {
    /**
     * `@weasel-js/font` is a leaf: core depends on it, never the reverse. Same
     * duplication failure as above, and worse to diagnose — a duplicated font
     * registry renders no glyphs at all.
     *
     * `scripts/` is deliberately out of scope: `gen-font.ts` is a build-time
     * CLI, outside `files` in package.json and never bundled into `dist`, so
     * it can't trigger the failure this guards.
     */
    files: ['packages/font/src/**/*.{ts,tsx}'],
    languageOptions,
    plugins,
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // The bare specifier, its subpath entries, and every one of
              // core's internal aliases — see CORE_ALIASES above.
              group: ['@weasel-js/core', '@weasel-js/core/*', ...CORE_ALIASES],
              message:
                '@weasel-js/font is a leaf package and must not import from core.',
            },
          ],
        },
      ],
    },
  },
  {
    /**
     * `@weasel-js/audio` depends on no weasel package at all: positional audio
     * takes plain `{ x, y }`, which is what lets a consumer use it without the
     * canvas. Its tsconfig extends the root, so every alias above resolves
     * from it and an accidental import would typecheck clean — nothing but
     * this rule catches one.
     */
    files: ['packages/audio/src/**/*.{ts,tsx}'],
    languageOptions,
    plugins,
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Its own name is how the workspace-resolution test imports it.
              group: ['@weasel-js/*', '!@weasel-js/audio', ...CORE_ALIASES],
              message:
                '@weasel-js/audio must not depend on any weasel package.',
            },
          ],
        },
      ],
    },
  },
];
