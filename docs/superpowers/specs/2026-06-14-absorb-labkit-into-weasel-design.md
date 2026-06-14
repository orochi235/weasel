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
