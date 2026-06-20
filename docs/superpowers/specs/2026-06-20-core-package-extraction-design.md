# Extract `@weasel-js/core` into `packages/core` — Design

Date: 2026-06-20
Status: design, queued (execute after the geometry migration; big chunk → worktree)
Motivation: make `npm install` work natively (npm is the canonical package manager) by removing a structural asymmetry — no band-aids.

## Problem (root cause)

The repository root is *simultaneously* two things:
1. the **publishable package** `@weasel-js/core` (name/version/`exports`/`files`/tsup build), and
2. the **workspace container** (`workspaces: ["packages/*"]`).

npm only treats entries under `packages/*` as workspaces. So when `packages/hud` and
`packages/ui` (both `private: true`) declare `@weasel-js/core@*`, npm cannot satisfy it from a
workspace and queries the registry → **E404** (the package is private/unpublished).
Confirmed: `npm install` and `npm ci` both fail. `pnpm` works only because it treats the repo
root as a workspace project and links it. Everything *runs* anyway because `weaselAliases` +
tsconfig `paths` redirect `@weasel-js/core` to `src/`, bypassing `node_modules` entirely.

This is the disease. `file:` links, npm `overrides` (tested — npm ignored `file:.`, still
404), or deleting the private deps are all band-aids that hide it.

## Fix: make the root a pure private container; core becomes a normal workspace

Move the publishable kit into `packages/core/`. The root becomes a private, non-publishable
monorepo container. Then **every** `@weasel-js/*` lives under `packages/*`, npm resolves all
intra-repo deps uniformly, `npm install` just works, and the existing `weaselAliases`
auto-discovery already emits `@weasel-js/core → packages/core/src/index.ts` from the directory
(no special-case needed).

### Before → after

```
BEFORE                                AFTER
/package.json  (@weasel-js/core)      /package.json        (private container, name: weasel-monorepo)
/src/...                              /packages/core/
/tsup.config.ts                         package.json       (@weasel-js/core — name/version/exports/files)
/typedoc.json                           tsconfig.json
/packages/{ui,hud,svg,geom,...}         tsup.config.ts
                                        typedoc.json
                                        src/...            (moved from root /src)
                                      /packages/{ui,hud,svg,geom,...}  (unchanged)
```

The root container keeps: `workspaces`, dev/test/build orchestration scripts, shared
devDependencies, `.changeset/`, repo-level config (`vitest.config.ts`, `vite.config.ts`,
`scripts/`, `tsconfig.json` as the shared base). It loses `name: @weasel-js/core`, `version`,
`exports`, `files`, `main`/`module`/`types`, and the publish identity — those move to
`packages/core/package.json`.

## Anchor inventory — everything rooted at `/src` and how it changes

| Anchor | Today | After |
|---|---|---|
| **`tsconfig.json`** `paths` | `@weasel-js/core → ./src/index.ts`, `/* → ./src/*`, `/routing → ./src/tools/routing`, bare `core/*`,`features/*`,`interactions/*`,`tools/*`,`canvas/*` → `./src/*` | point all at `./packages/core/src/...`; `include` `"src"` → `"packages/core/src"`. Move the kit's `baseUrl`-style bare-path resolution into `packages/core/tsconfig.json` (`baseUrl: src`); keep a thin shared base at root. |
| **`tsup.config.ts`** | entries `src/index.ts`, `src/import-shims/*`, `src/tools/routing` | moves to `packages/core/tsup.config.ts`; entries relative to `packages/core/src`; `dist` emits under `packages/core/dist`. |
| **`scripts/vite-aliases.ts`** kit block | hand-written `@weasel-js/core → repoRoot/src/index.ts`, `@weasel-js/core/* → repoRoot/src/import-shims/$1`, bare `core/* … → repoRoot/src/*` | `@weasel-js/core` now auto-emitted by `packageAliases` (delete the hand-written bare-package + wildcard entries); keep the `import-shims` subpath rule and the bare-path (`core/`,`features/`,…) rules but repoint to `packages/core/src`. |
| **`vitest.config.ts`** | `kit` project `include: src/**`; `smoke` `src/**`; `include` ref `src` | repoint `kit`/`smoke` globs to `packages/core/src/**`. (`weasel-ui` already covers `packages/**`.) |
| **root `vite.config.ts`** (demo) | aliases via `weaselAliases(__dirname)`; demo entry | repoint any explicit `src/...` refs to `packages/core/src`; `weaselAliases` handles the rest. |
| **`apps/draw/vite.config.ts`** | `dedupe`/resolve refs to `repoRoot/src/tools`, `repoRoot/src/interactions/actions` | repoint those two to `repoRoot/packages/core/src/...`; `weaselAliases(repoRoot)` otherwise unchanged. |
| **`typedoc.json`** | `entryPoints: ["src/index.ts"]` | `["packages/core/src/index.ts"]` (or move into `packages/core/`). |
| **root `package.json`** | the published package | split: container (private) + `packages/core/package.json` (publish identity). Scripts that build/publish (`build` tsup, `prepublishOnly`, `release`) target `packages/core`. |
| **`.changeset/config.json`** | versions the root package | unchanged mechanics; the versioned package is now `packages/core` (changesets discovers workspaces). |
| **kit source imports** | `from 'features/paths'`, `from 'core/...'` etc. | **unchanged** — resolved by `packages/core/tsconfig` `baseUrl: src` + the repointed bare-path aliases. No source edits. |

Note: the bare-path aliases (`core/`, `features/`, …) are global in `weaselAliases` rather
than package-scoped — a mild wart that persists but now clearly belongs to `packages/core`.
Scoping them is out of scope for this change.

## Phasing (each step leaves the suite green)

1. **Create `packages/core/` skeleton** — `package.json` (publish identity moved off root),
   `tsconfig.json`, `tsup.config.ts`, `typedoc.json`. Root `package.json` becomes the private
   container. Don't move `src` yet; temporarily point new configs at `../../src` to prove the
   split builds.
2. **`git mv src packages/core/src`** in one commit (preserves history).
3. **Repoint every anchor** in the table to `packages/core/src`. Run `npm run typecheck` +
   `npm run test:unit` green.
4. **Verify `npm install` works** from a clean state (the payoff): `rm -rf node_modules &&
   npm install` succeeds with no E404; `npm ci` succeeds against the regenerated
   `package-lock.json`.
5. **Verify the published artifact is unchanged** — `npm run build` produces the same
   `dist` entry set (now under `packages/core/dist`); diff the `.d.ts` surface against a
   pre-change build to confirm no API drift.
6. **Commit the regenerated `package-lock.json`** (npm is canonical; the lockfile is the
   committed source of truth).

## Verification (definition of done)

- `rm -rf node_modules && npm install` → exit 0, no E404. **This is the headline success.**
- `npm run typecheck` → 0 errors.
- `npm run test:unit` → same pass count as before (4544 + the geom 42, modulo whatever the
   geometry migration adds).
- `npm run build` → identical entry set; `.d.ts` public surface diff is empty.
- `apps/draw` dev + build still resolve (`npm run dev:draw`, `npm run build:draw`).

## Open question

- **Root container name.** It must change off `@weasel-js/core`. Recommend `weasel-monorepo`
  (`private: true`). Purely cosmetic (never published); pick at execution time.

## Risks

- **Wide config churn** — many config files repoint at once. Mitigated by phasing (skeleton
   proves the split before `src` moves) and the green-suite gate at each step.
- **Publish flow** — `prepublishOnly`/`release`/changesets now target `packages/core`. Verify
   a dry-run `changeset version` + `npm pack` in `packages/core` yields the expected tarball.
- **CI** — if CI currently leans on pnpm (because npm install is broken), this change lets CI
   switch to `npm ci`. Confirm the CI workflow and update it in the same change (grep
   `.github/workflows` for `pnpm`/`npm ci`).
- **`dist` consumers** — anything referencing root `dist/` (smoke-consumer bundle test,
   `scripts/smoke-consumer-bundle.mjs`) must point at `packages/core/dist`.

## Relationship to the geometry work

Independent. The geometry migration resolves `@weasel-js/geom`/`core` via aliases, so it is
unaffected by the broken `npm install` and does not need this first. Execute this extraction in
its own worktree after the geometry migration lands.
