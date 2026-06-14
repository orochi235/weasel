# Absorb labkit into the weasel monorepo

**Date:** 2026-06-14
**Status:** In progress (branch `feat/absorb-labkit`)

## Goal

Fold the standalone `labkit` repo into the weasel monorepo as a published
workspace package, eliminating the cross-repo `file:` dependency, the
dist-bundling workaround, the separate CI/docs/Storybook, and the `@lab-kit`
npm-scope dead-end. labkit becomes `@orochi235/labkit`, a sibling of the other
`packages/*` members, released through weasel's existing changesets flow.

## Why (context)

labkit is a **library** (`@lab-kit/react`: an exports map, consumed via
`npm install`), not an app. weasel's `apps/*` (`draw`, `swillustrator`) are
unpublished end-products with no `package.json`. So labkit's correct home is
`packages/labkit`, parallel to `weasel-ui` — one layer up the same stack.

Nothing of either project is published to npm yet, so there is no published
continuity to break. Consolidation removes:

- `file:../weasel` cross-repo deps → workspace `*` deps
- the Path-A "bundle weasel into labkit's dist" cross-repo symlink machinery
- a second CI pipeline, Storybook, and Pages site
- the `@lab-kit` / `@weasel` scope hunt (labkit ships under `@orochi235`)

## Target layout

```
weasel/
  packages/
    weasel-ui/  weasel-modes/  ...      # existing
    labkit/                             # NEW — @orochi235/labkit
  apps/
    draw/  swillustrator/               # existing
    # labkit examples may be promoted here later (out of scope for v1)
```

## Package & build changes

- **Rename** `@lab-kit/react` → `@orochi235/labkit`; `private: false`.
- **Deps:** `@orochi235/weasel*` become workspace `*` (no `file:`).
- **tsup:** drop the `preserveSymlinks` cross-repo hack. Keep the architecture
  that mirrors the root weasel package: `noExternal`-bundle the **private**
  sub-packages labkit uses (`weasel-ui`, `weasel-modes`) into labkit's dist;
  keep the **published** core `@orochi235/weasel` external; keep
  `dts.resolve` so the bundled-in types inline. Third-party libs
  (`react-aria-components`, `earcut`, `polygon-clipping`, `zustand`) stay
  external + declared as labkit deps.
- **Release:** labkit joins weasel's changesets set — the monorepo's second
  public package (`@orochi235/weasel` + `@orochi235/labkit`).
- **Build order:** weasel core builds before labkit (labkit bundles weasel-ui
  which imports the built `@orochi235/weasel`).

## Storybook / docs / examples

- **Storybook:** add `packages/labkit/src/**/*.stories.@(ts|tsx)` to weasel's
  `.storybook/main.ts` stories glob — one unified Storybook (port 6010).
- **Docs:** labkit's VitePress content folds into weasel's Pages site under a
  `/labkit` section; labkit's standalone VitePress/Pages workflow is retired.
- **Examples:** labkit's `examples/` stay under `packages/labkit/examples` for
  v1; promotion to `apps/` is a later, optional step.

## Git history

Preserve all 115 labkit commits with per-file history:

1. `brew install git-filter-repo`.
2. In a throwaway labkit clone:
   `git filter-repo --to-subdirectory-filter packages/labkit`.
3. In the weasel `feat/absorb-labkit` worktree (based on `main`):
   add the rewritten clone as a remote and
   `git merge --allow-unrelated-histories <clone>/main`.

`git subtree` was rejected (messier history). Submodules were rejected — they
preserve the two-repo split this change exists to remove.

## Decommissioning the labkit repo (deferred — one-way doors)

Held until the merge is reviewed/merged and the package publishes cleanly:

- Replace `orochi235/labkit` Pages with an `index.html` + `404.html`
  meta-refresh/JS redirect to `orochi235.github.io/weasel/labkit/` (GitHub Pages
  has no server-side redirects; `404.html` catches deep links).
- Archive the `orochi235/labkit` repo with a README pointer. (The repo URL only
  auto-redirects on rename/transfer, which this isn't — so it becomes an
  archived pointer, not a redirect.)

## Execution order

1. Worktree off `main`; write this spec. ✓
2. filter-repo + merge labkit → `packages/labkit`.
3. Rename package, workspace deps, simplify tsup, wire changesets/Storybook.
4. `npm install` at root; build weasel then labkit; run labkit tests.
5. Push branch. **Stop** — PR, repo archival, Pages redirect, and publish wait
   for review.

Everything through step 4 is branch-local and reversible.

## Status (branch `feat/absorb-labkit`, pushed for review)

**Done**
- filter-repo merge: all 115 labkit commits preserved under `packages/labkit/`.
- Renamed `@lab-kit/react` → `@orochi235/labkit`; workspace member; all
  `@lab-kit/react` import specifiers updated.
- Deps: third-party (`earcut`, `polygon-clipping`, `react-aria-components`,
  `zustand`) declared; `weasel-ui`/`weasel-modes` are devDeps; the core is
  bundled (not a dep).
- tsup: bundles all `@orochi235/weasel*` into labkit's dist (core resolves to
  its built `dist/index.js` via an esbuild alias; ui/modes from workspace src).
  **JS output is fully self-contained — zero `@orochi235` runtime imports.**
- devDeps pruned to what the root lacks (`biome`, `jest-dom`, `less`, `tsx`);
  Storybook/Vite/etc. come from the root (resolves the SB8-vs-Vite8 conflict).
- vite/vitest configs reuse the monorepo `weaselAliases` (was pointing at a
  now-absent `node_modules/@orochi235/weasel`).
- Removed package-local cruft: `.github/` (inert), `.npmrc`, `package-lock.json`.
- `npm install` green; `npm run build` green; tests **237/238** (the one failure
  is a pre-existing `LayerStack` dlog-mock issue, identical on the source repo).

**Deferred (follow-ups — not done on this branch)**
1. **`.d.ts` emission is OFF** (publish blocker). Diagnosed in depth:
   - tsup's rollup-dts resolves workspace members via their node_modules
     symlinks but can't resolve the root-package core `@orochi235/weasel` (no
     symlink), and it ignores the tsconfig `paths` that `tsc` honors (verified:
     `tsc -p tsconfig.dts.json` resolves everything cleanly).
   - The core *does* emit `dist/index.d.ts`, but those types are **lossy**:
     weasel's own dts bundling collapses the `DepRegistry`/`DepSchema` generics,
     so e.g. `depReg.get('selection')` types to `never` (surfaces in
     `weasel-ui/ActionBar`). Against weasel **source** the same code types
     correctly. So labkit must build types from SOURCE, not the core's dist.
   - **Plan (paths-aware, multi-entry):** add devDeps `rollup-plugin-dts` +
     `@rollup/plugin-alias`; write `scripts/build-dts.mjs` that runs rollup over
     all 11 entry points with rollup-plugin-dts + an alias plugin fed by the
     monorepo's `weaselAliases(weaselRoot)` (resolves `@orochi235/weasel*` and
     the bare `core/`,`features/`,… imports against source). Replace tsup's dts
     (`dts: false` stays) with `"build:dts": "node scripts/build-dts.mjs"` in the
     build script. `tsconfig.dts.json` (already staged) supplies the compiler
     options; exclude `*.stories.tsx`/`*.test.tsx` from the dts input.
   - Alternative if rollup-plugin-dts also fights the source compile: API
     Extractor per entry (11 configs), or give weasel-ui/modes real built dist
     types. rollup-plugin-dts + alias is the first attempt (reuses weaselAliases,
     handles multi-entry natively).
2. **`noUncheckedIndexedAccess` left off** in labkit's build tsconfig — the
   bundled `weasel-ui/src/useReorderDragList.ts` has 4 latent violations. Fix
   them in weasel-ui and restore the flag.
3. **Storybook not unified** — labkit is on Storybook 8, root on 10. Migrate
   labkit stories (import changes) then add `packages/labkit/src/**/*.stories`
   to `.storybook/main.ts`.
4. **Docs/Pages not folded in**; **examples** still under `packages/labkit/`.
5. **Changesets**: labkit not yet added to a release changeset.
6. One-way doors (labkit repo archival + Pages redirect, publish) — untouched.

Built/tested from `main` (12 commits ahead of the in-progress
`chore/phase5-...` branch); rebase onto the latest trunk before merge.
