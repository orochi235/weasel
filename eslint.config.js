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
 * ESLint flat config: architectural boundaries, then a correctness baseline.
 *
 * No formatting rules and no type-aware rules — `tsc --noEmit` covers types,
 * and nothing here should have an opinion about layout. The scoped blocks
 * below carry the dependency arrows the type system can't express; the
 * baseline block near the bottom carries rules that catch bugs.
 *
 * Deliberately off, and why:
 *   - eslint-plugin-react-hooks v7's compiler rules (`refs`, `immutability`,
 *     `set-state-in-effect`, `use-memo`, `globals`, `static-components`).
 *     `refs` alone reports 387 times across 103 files, because reading a ref
 *     during render is how a canvas library gets at mutable frame state. Worth
 *     revisiting per rule; not worth adopting as a block.
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
    // A disable directive naming a rule nothing enforces is a comment claiming
    // a problem that isn't there.
    linterOptions: { reportUnusedDisableDirectives: 'error' },
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
     * `@weasel-js/text` is a leaf: core's renderer depends on it (its
     * `DrawCommand` names `ResolvedRun`), never the reverse. A reach back into
     * core would duplicate the layout module the renderer caches against.
     */
    files: ['packages/text/src/**/*.{ts,tsx}'],
    languageOptions,
    plugins,
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@weasel-js/core', '@weasel-js/core/*', ...CORE_ALIASES],
              message:
                '@weasel-js/text is a leaf package and must not import from core.',
            },
          ],
        },
      ],
    },
  },
  {
    /**
     * `@weasel-js/paint` is the bottom of the stack: plain paint vocabulary,
     * named by text, geometry and the renderer alike. It imports nothing.
     */
    files: ['packages/paint/src/**/*.{ts,tsx}'],
    languageOptions,
    plugins,
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@weasel-js/*', '!@weasel-js/paint', ...CORE_ALIASES],
              message:
                '@weasel-js/paint must not depend on any weasel package.',
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
  {
    /**
     * The baseline. Rules are enumerated rather than spread from a plugin's
     * `recommended`, because a preset changes what this repo enforces whenever
     * a dependency is upgraded, and the two react-hooks presets in particular
     * now carry the compiler rules deliberately left off below.
     */
    files: ['**/*.{ts,tsx}'],
    languageOptions,
    plugins,
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/prefer-as-const': 'error',

      // A library warning its own consumer is a feature — 80 `console.warn`
      // and 21 `console.error` calls are that. `log` and `debug` are residue.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // `ignoreReadBeforeAssign` spares the case where a closure built before
      // the assignment reads the binding — `const` there is a TDZ crash, not a
      // tidy-up. `Toast/queue.ts` needs the key inside an `onClose` it must
      // pass to the very call that returns that key.
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
      'no-var': 'error',
      // `== null` is the idiomatic nullish check and the only loose comparison
      // in the tree — all 317 reports were that one shape, so the exception is
      // the rule's whole content here.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      // A leading underscore is how this repo already spells "declared and
      // deliberately not read": a positional parameter before the one that is
      // used, a destructured field being dropped, a caught error nobody
      // inspects. 135 of the 136 reports were that.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    /**
     * `any` in a test is usually the point: reaching past a type to build a
     * malformed input, or asserting on a private field. The rule earns its
     * keep on shipped surface, where an `any` is a hole in the contract.
     */
    files: ['**/*.{test,spec}.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}', '**/testing/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    /**
     * A CSF story's `render` is not a component, so every hook it calls reads
     * as a violation. The 27 reports here were all that shape.
     *
     * Stories aren't shipped, and a handler that logs is how you see a story
     * fire — `no-console` has nothing to protect here either.
     */
    files: ['**/*.stories.{ts,tsx}'],
    rules: { 'react-hooks/rules-of-hooks': 'off', 'no-console': 'off' },
  },
  {
    /**
     * Build-time CLIs, where stdout is the interface: what got baked, how many
     * themes were emitted, whether the prefix check passed. A tool that runs
     * for minutes in silence is indistinguishable from a hung one.
     */
    files: ['**/scripts/**/*.{ts,tsx,js,mjs}'],
    rules: { 'no-console': 'off' },
  },
];
