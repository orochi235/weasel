# Sub-package publishing: reversing the tsup inlining

**Date:** 2026-07-26
**Status:** design — pending approval
**Supersedes the packaging half of:** `2026-06-20-core-package-extraction-design.md`

## Problem

`tsup.config.ts` carries `noExternal: [/^@weasel-js\//]`, which inlines
`geom`, `gestures`, `history`, and `modes` — source and declarations — into
`dist/` of `@weasel-js/core`. All four are `private: true` and never published.

The config comment states the reason:

> The `@weasel-js/*` workspace sub-packages (history, gestures, modes) are NOT
> independently buildable — they reach into this package's `src/core` and
> `src/debug` via shared tsconfig path aliases, not public API.

**That premise is now false.** Verified import graph (non-relative imports,
excluding `vitest`):

| package    | imports                    |
| ---------- | -------------------------- |
| `geom`     | `polygon-clipping`         |
| `gestures` | *(none)*                   |
| `history`  | *(none)*                   |
| `modes`    | *(none)*                   |
| `svg`      | `@weasel-js/core`          |
| `d3`       | `@weasel-js/core`          |
| `theme`    | *(none)*                   |
| `hud`      | `@weasel-js/core`, `@weasel-js/theme` |
| `ui`       | `@weasel-js/core`, `@weasel-js/modes` |

Four true leaves with zero reach-back into core. `56f5193f` (Op → history,
registry/logger as injected seams) and `ea0df120` (SVG ingestion → svg)
removed the last edges. The only remaining `src/` → `@weasel-js/svg` reference
is a test file (`src/canvas/sceneCanvas.ingestion.test.tsx`); the three
production mentions are doc comments. The graph is acyclic:

```
geom  gestures  history  modes  theme      (leaves)
   \      |        |       |    /
        @weasel-js/core               <- repo ROOT
       /       |       |      \
     svg      d3      ui      hud     (downstream)
```

The inlining is vestigial scaffolding around a constraint that no longer
exists.

### Why it must go

1. **Duplicate module identity.** Once `geom` ships standalone, any consumer
   holding both it and `core` gets two copies — plus two copies of
   `polygon-clipping`. This is the exact failure mode `tsup.config.ts` already
   documents for the font registry under `splitting: false`: two instances of
   what should be one module. Today's injected-seam design in `history` means
   no live singleton, so this is latent rather than active. It is a landmine,
   not a non-issue.
2. **`svg`/`ui`/`hud`/`d3` are unpublishable.** They import `@weasel-js/core`;
   their `.d.ts` would reference types that exist only *inside* core's bundle,
   at no resolvable specifier.
3. **`geom` and `history` are useful alone** — a dependency-free geometry
   kernel and a headless undo engine, currently hidden inside a React canvas
   library.

## Decisions taken

- **Versioning: lockstep.** `.changeset/config.json` gets an explicit `fixed`
  group. It must be enumerated, **not** the glob `"@weasel-js/*"`, because
  `labkit` is deliberately excluded (see Open questions):
  `"fixed": [["@weasel-js/core", "@weasel-js/geom", "@weasel-js/gestures",
  "@weasel-js/history", "@weasel-js/modes", "@weasel-js/svg",
  "@weasel-js/d3", "@weasel-js/theme", "@weasel-js/ui", "@weasel-js/hud"]]`.
  Every package in the group shares one version; core pins
  exact versions of its siblings (`"@weasel-js/geom": "0.5.0"`). Accepts
  version churn on stable leaves in exchange for one number to reason about
  and trivially correct dependency ranges.
- **Scope: everything publishable** — `geom`, `gestures`, `history`, `modes`,
  `svg`, `d3`, `theme`, `ui`, `hud`, alongside `core`. (`labkit` is already
  non-private with its own build; see Open questions. `den` has no
  `package.json` and is out of scope.)

## The structural blocker: core lives at the repo root

`workspaces: ["packages/*"]` does not include the root package, so npm never
creates `node_modules/@weasel-js/core`. Confirmed — the directory holds
symlinks for d3, gestures, history, hud, labkit, modes, svg, theme, and ui,
and no core. (`geom` is also absent, but only because it postdates the last
install; it *is* a workspace and will link on reinstall.)

`packages/labkit/tsup.config.ts` already documents what this costs:

> tsup's built-in dts can't resolve the root-package core `@weasel-js/core`
> (it follows node_modules symlinks but the monorepo core is the repo ROOT,
> which has none) and ignores the tsconfig `paths` that tsc honors — so types
> drifted to `never`.

labkit paid for it with a bespoke `scripts/build-dts.mts` that re-aliases every
weasel specifier back to source. Publishing `svg`, `ui`, `hud`, and `d3` means
four more packages hitting the identical wall and needing the identical
workaround.

**Proposal: move core to `packages/core/` as a real workspace member.** The
repo root becomes a private, unpublished workspace manager holding only
`workspaces`, devDependencies, and orchestration scripts.

This is a prerequisite, not a nice-to-have. It buys:

- A real `node_modules/@weasel-js/core` symlink, so stock `tsup --dts`
  resolves core from every dependent. No per-package dts pipeline.
- Deletion of `scripts/build-dts.mts` and labkit's `noExternal` +
  `esbuildOptions.alias` hack (labkit can depend on published core instead of
  bundling it).
- One uniform package shape. Today core alone is special: root `.npmignore`
  instead of `files`, root `tsconfig.json` doubling as both the solution config
  and core's build config, `dist/` at the repo root.
- Removal of the root-package-is-core weirdness that already broke fresh
  worktree installs once (PR #6).

Cost: a large, mostly mechanical `git mv` touching nearly every path-bearing
config — `tsconfig.json` paths, `scripts/vite-aliases.ts`, `vite.config.ts`,
`vitest.config.ts`, `typedoc.json`, `.github/workflows/*`, `apps/*/vite.config.ts`.
`scripts/vite-aliases.ts` already enumerates `packages/` at config-load time,
so core stops being a special case there and that file gets *smaller*.

## Packaging tiers

Three distinct build shapes, not one:

### Tier A — pure TypeScript leaves

`geom`, `gestures`, `history`, `modes`

Stock `tsup`: `format: ['esm']`, `dts: true`, `treeshake`, `sourcemap`.
`exports` repointed `src/index.ts` → `dist/`. Drop `private: true`. `geom`
keeps `polygon-clipping` as a real dependency and its `./booleans` subpath.
Zero novel problems.

### Tier B — TypeScript depending on core

`svg`, `d3`

Same as Tier A plus `@weasel-js/core` in `dependencies` (`peerDependencies`
for `d3`, which also has optional `d3-force`/`d3-ease` peers). Requires the
core-to-`packages/` move for dts to resolve. `svg`'s `src/__fixtures__/*.svg`
are test-only and excluded from `files`.

### Tier C — packages shipping assets

`theme`, `ui`, `hud` — **these cannot use tsup.**

- **`theme`** ships `src/tokens.css` raw via an `exports` entry, already
  `sideEffects: ["*.css"]`. Simplest of the three: copy the CSS, emit a tiny
  TS bundle. Note `scripts/vite-plugin-weasel-tokens.ts` reads
  `packages/theme/src/tokens.css` from disk for the Storybook addon — it reads
  source, not dist, so it is unaffected.
- **`ui`** has **41 `*.module.css` files**. CSS Modules through tsup/esbuild
  means class-name hashing, a scoped-name contract, and an emitted stylesheet
  esbuild handles only awkwardly.
- **`hud`** imports font assets with Vite-specific query suffixes —
  `import metricsUrl from './inter.json?url'` and `'./inter.png?url'` in
  `src/fonts/registerDefaultFont.ts`. esbuild does not understand `?url` at
  all.

**Proposal: build Tier C with Vite library mode** (`build.lib`), which has
first-class CSS Modules and asset handling, plus `vite-plugin-dts` for
declarations. Emit `dist/style.css` per package and expose it as an
`exports` entry the consumer imports, matching how `apps/draw/src/main.tsx`
already does `import '@weasel-js/theme/tokens.css'`.

The alternative — teach `hud` to load fonts without `?url` and push `ui`'s CSS
modules through esbuild — is more invasive and worse. Two build tools split
cleanly along "ships assets / doesn't" is a legible rule, not a band-aid.

## Release mechanics

- `.changeset/config.json`: `"fixed": [["@weasel-js/*"]]`.
- Root `package.json` becomes private; `release` runs `changeset publish`
  across all workspaces. `prepublishOnly` moves per-package; the root gets a
  `build` that fans out in dependency order (leaves → core → downstream).
- Root `.npmignore` is deleted in favor of a `files` array in each package —
  `.npmignore` is a root-package artifact with no place in a workspace layout.
- `.github/workflows/release.yml` and `ci.yml` need their build steps
  retargeted at the fan-out script rather than the root `tsup`.

## Verification changes

`scripts/smoke-consumer-bundle.mjs` currently asserts *that inlining works* —
its header documents the two failure classes the `noExternal` hack exists to
prevent. It inverts: `npm pack` each package into a temp consumer outside the
repo tree and install the tarballs together, then bundle with esbuild and
typecheck with `tsc`. That is a strictly stronger test, because it exercises
real cross-package resolution instead of asserting resolution never happens.

It should additionally assert the property motivating the whole change:
**exactly one copy** of each sub-package in the consumer's resolved tree.

`tsup.config.ts` loses `noExternal` and its 20-line comment. Both halves of the
current hack — keeping sub-packages out of `dependencies`, and the tsconfig
`paths` aliasing — unwind together, since tsup derives its dts `external` list
from deps+peerDeps automatically.

**Unchanged: the local development loop.** `scripts/vite-aliases.ts` generates
aliases from `packages/` at config-load time, pointing every `@weasel-js/*` at
`src/`, and `tsconfig.json` `paths` mirrors it. Editing
`packages/history/src/…` stays live in `apps/draw` with no build step. This
work does not touch that; it changes only the shape of the published artifact.

## Open questions

1. ~~**`labkit`.**~~ **Decided 2026-07-26: stays independent.** It is a
   different product — lab-page widgets, not canvas kit — so lockstepping it
   to core's version would misrepresent it. Excluded from the `fixed` group;
   keeps its own version line and its own build. It *does* still benefit from
   the phase-1 core move (it can drop `build-dts.mts` and depend on a
   resolvable core), so it is in scope for cleanup but not for versioning.
2. ~~**`den`**~~ — **out of scope**, left as-is.
3. **Initial version.** Core is at `0.4.0`; every sub-package is `0.0.0`.
   Lockstep implies all jump to a shared number — `0.5.0` for the whole set
   seems right, with the packaging change itself as the minor bump.
4. **`ui` and `hud` peer-depend on core, or depend on it?** Peer is more
   correct (a consumer holding two core versions is a real bug) but pushes an
   install burden onto consumers. Recommend `peerDependencies` for `ui`,
   `hud`, and `d3` — all React-facing — and a plain dependency for `svg`.

## Phasing

Each phase ends green and is independently mergeable.

1. ~~**Move core to `packages/core/`.**~~ **SHIPPED 2026-07-26** (branch
   `core-to-packages`). `node_modules/@weasel-js/core` now exists. Isolating
   core's build surfaced three latent leaks where it compiled only because a
   demo app's ambient types shared its tsconfig program — bare
   `import.meta.env` (typed by `apps/site/vite-env.d.ts`'s `vite/client`
   reference), CSS Module imports with no declaration of core's own, and
   `@weasel-js/core/<subpath>` resolving by package self-reference into the
   built `dist/` (making typecheck silently depend on a prior build). All
   three fixed; see the commit body. Gates: typecheck, 5113 tests, core +
   labkit builds, both consumer smoke tests, `build:demo`, typedoc 0 warnings.
2. **Tier A + B independent builds.** Per-package tsup configs; packages go
   public; core's deps flip; `noExternal` deleted; smoke test inverted.
3. **Tier C Vite library builds.** `theme`, then `ui`, then `hud`.
4. **Release wiring.** Changesets `fixed`, fan-out build, CI, first publish.

Phase 1 is the one worth doing carefully — it is large, touches every config,
and everything after it is straightforward.
