# App build info: kit version + compile date

**Date:** 2026-07-30
**Status:** approved, not yet implemented

## Problem

Nothing in the repo lets a running app say what it is. Open
https://orochi235.github.io/weasel/draw/ and there is no way — from the UI, the
console, or devtools — to tell which kit version it was built against or when it
was compiled. Bug reports and screenshots are therefore unanchored: "the palette
is broken" can't be matched to a commit.

`apps/draw` and `apps/site` have no `package.json` (they aren't workspaces; the
root builds them via `build:draw` / `build:demo`), so there is no app semver to
report even if we wanted one.

## Decisions

1. **Identity = kit lockstep version + compile date.** No app-level semver is
   introduced. What matters in practice is "which kit is this running, and how
   fresh is the build."
2. **`@weasel-js/core` exports `VERSION`.** Core only — every package is in
   lockstep (0.7.0 today), and every app already depends on core.
3. **One surface: the status bar.** No About dialog, no console banner, no
   `window` global. Those can be added later against the same constant.

## Design

### 1. `VERSION` in core

New `packages/core/src/version.ts`:

```ts
declare const __WEASEL_CORE_VERSION__: string | undefined;

/** The kit version this build was compiled from. */
export const VERSION: string =
  typeof __WEASEL_CORE_VERSION__ === 'string' ? __WEASEL_CORE_VERSION__ : '0.0.0-unknown';
```

Re-exported from `packages/core/src/index.ts`.

Single source of truth is `packages/core/package.json`, substituted at two
different build times:

- **Published builds** — `define` in `packages/core/tsup.config.ts`, reading its
  own `package.json`. Changesets bumps that file during release, so the next
  build bakes the new number with no separate step to remember.
- **In-repo builds (dev servers, tests, app bundles)** — the shared helper
  below. Source aliases (`weaselAliases`) mean the published `dist` is never
  involved in dev, so the define has to be re-applied per config.

The `'0.0.0-unknown'` fallback fires only when core's source is imported with no
define configured. It is honest and cannot crash.

### 2. Shared define helper

New `scripts/vite-build-info.ts`:

```ts
export function weaselDefines(repoRoot: string): Record<string, string>
```

Returns:

| Global | Value |
|---|---|
| `__WEASEL_CORE_VERSION__` | `version` from `packages/core/package.json` |
| `__WEASEL_BUILD_DATE__` | ISO timestamp captured at config load |

Spread into `define` in `vite.config.ts` (covers `apps/site`),
`apps/draw/vite.config.ts`, `vitest.config.ts` (into the `shared` block, so all
projects get it), and `.storybook/main.ts` (`viteFinal`).

`__WEASEL_BUILD_DATE__` is the *app's* compile time, not the kit's. In CI it is
the deploy moment — `pages.yml` builds fresh on every run. On a dev server it is
when the server started, which the UI labels as dev rather than passing off as a
build.

### 3. Status bar rendering

One span at the right end of `.wd-statusbar` (`apps/draw/src/App.tsx`), after
zoom:

- production: `0.7.0 · Jul 30`, with the full ISO timestamp in `title`
- dev (`!import.meta.env.PROD`): `0.7.0 · dev`

New `.wd-build` rule in `apps/draw/src/app.css` — dimmed, `tabular-nums`, no
layout impact on the existing spacer.

Date formatting is a small local helper, not a new dependency.

### 4. Tests

- `packages/core/src/version.test.ts` — asserts `VERSION` equals the `version`
  in `packages/core/package.json`. Because vitest gets the define from the same
  shared helper, this guards the wiring rather than restating a constant, and it
  fails loudly if a config drops the define.
- A draw status-bar test asserting the span renders and carries a `title`.

## Out of scope

- App-level semver / making `apps/*` real workspaces.
- `VERSION` on the other nine packages. Revisit if lockstep ever ends.
- About dialog, console banner, `window.__WEASEL_BUILD__`.
- Git SHA. The version + date pin a release closely enough; a SHA would need CI
  plumbing for a marginal gain.
