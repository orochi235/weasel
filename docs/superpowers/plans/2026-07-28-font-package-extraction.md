# `@weasel-js/font` Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the MSDF glyph tier from `@weasel-js/core` into a new Tier A leaf package `@weasel-js/font`, and replace the "unregistered font family renders nothing" trap with a configurable fallback policy.

**Architecture:** `packages/font/` is a pure-TypeScript leaf with zero `@weasel-js/core` imports. Core gains it as a dependency, exactly like `geom`/`gestures`/`history`/`modes`. The only coupling — core's `GLTextureCache` — becomes a structural `GlyphTextureSink` interface the leaf declares and core's class satisfies for free. Everything ships as one lockstep `0.7.0`.

**Tech Stack:** TypeScript, tsup (esbuild), vitest, npm workspaces, changesets.

**Spec:** `docs/superpowers/specs/2026-07-28-font-package-extraction-design.md`

**Branch:** `text-font-split` (already created; the two specs are committed there).

---

## Orientation for someone new to this repo

- **Workspaces** live in `packages/*`. `packages/core` is the big one; the rest are leaves or downstream packages.
- **Three build tiers** (see `docs/superpowers/specs/2026-07-26-subpackage-publishing-design.md`): Tier A = pure TS leaves built with tsup via `scripts/tsup-preset.ts`; Tier B = TS depending on core; Tier C = packages shipping assets, built with Vite. **`font` is Tier A.**
- **Path aliases exist in three places.** `scripts/vite-aliases.ts` auto-discovers `packages/*` (no edit needed). The root `tsconfig.json` `paths` map is **hand-maintained** (edit required). `vitest.config.ts` projects glob by path (no edit required — see below).
- **Which vitest project runs the new tests:** the `weasel-ui` project includes `packages/**/*.test.{ts,tsx}` and excludes only `packages/labkit/**` and `packages/core/**`. So `packages/font` tests are picked up automatically by `npm run test:ui`. The project's name is historical; don't rename it.
- **Never run `git add -A`.** Another session may share this checkout. Stage explicit paths, as every commit step below does.
- **Import style inside core** uses bare aliases (`features/text/...`, `core/paint-types`) mapped in `tsconfig.json`, not deep relative paths. New cross-package imports use `@weasel-js/font`.

---

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `packages/font/package.json` | Tier A manifest, `0.6.0`, no dependencies |
| `packages/font/tsup.config.ts` | Single-entry build via the shared preset |
| `packages/font/README.md` | What the package owns, and the fallback policy |
| `packages/font/src/index.ts` | The package barrel — the entire public surface |
| `packages/font/src/textureSink.ts` | `GlyphTextureSink` + `TexSource` (the seam) |
| `packages/font/src/fallback.ts` | Fallback policy state + `warnOnceMissingFamily` |
| `packages/font/src/leaf-purity.test.ts` | Asserts the package imports nothing from core |

**Moved** (via `git mv`, so history follows):

| From | To |
| --- | --- |
| `packages/core/src/features/text/atlas/FontAtlas.ts` (+ `.test.ts`) | `packages/font/src/FontAtlas.ts` |
| `packages/core/src/features/text/atlas/GlyphLayout.ts` (+ `.test.ts`) | `packages/font/src/GlyphLayout.ts` |
| `packages/core/src/features/text/atlas/registerFont.ts` (+ `.test.ts`) | `packages/font/src/registerFont.ts` |
| `packages/core/src/features/text/atlas/genFontSmoke.test.ts` | `packages/font/src/genFontSmoke.test.ts` |
| `packages/core/src/features/text/dynamic/*` (5 files + 3 tests) | `packages/font/src/dynamic/*` |
| `packages/core/src/renderer/shaders/textSdf.ts` | `packages/font/src/textSdf.ts` |
| `scripts/gen-font.ts` + `scripts/msdf-bmfont-xml.d.ts` | `packages/font/scripts/` |

**Modified:** `packages/core/package.json`, `packages/core/src/features/text/atlas/layoutRuns.ts`, `packages/core/src/features/text/measureTextBounds.ts`, `packages/core/src/renderer/draw.ts`, `packages/core/src/renderer/WeaselRenderer.ts`, `packages/core/src/renderer/index.ts`, `packages/core/src/canvas/SceneCanvas.tsx`, `packages/hud/package.json`, `packages/hud/src/fonts/registerDefaultFont.ts`, root `tsconfig.json`, root `package.json`, `.changeset/config.json`, `scripts/smoke-consumer-bundle.mjs`, `packages/core/src/features/text/README.md`, `docs/TODO.md`.

**Explicitly NOT moved:** `packages/core/src/features/text/atlas/layoutRuns.ts` (+ test). It needs `FillStyle` and `ResolvedRun`; moving it would force a `paint` leaf extraction. See spec §3.

---

## Task 1: Scaffold the package

**Files:**
- Create: `packages/font/package.json`, `packages/font/tsup.config.ts`, `packages/font/src/index.ts`, `packages/font/README.md`
- Modify: `tsconfig.json` (paths), `package.json` (build:leaves)

- [ ] **Step 1: Create the manifest**

`packages/font/package.json` — modeled on `packages/geom/package.json`, minus dependencies. Version is `0.6.0` deliberately: it enters the lockstep group at the current version and rides the bump in Task 10.

```json
{
  "name": "@weasel-js/font",
  "version": "0.6.0",
  "description": "MSDF font atlases, glyph metrics, and runtime glyph rasterization for @weasel-js/core. Registry, kerning-aware glyph layout, and the SDF text shader source.",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "test": "vitest run",
    "build": "tsup"
  },
  "author": "orochi235",
  "homepage": "https://orochi235.github.io/weasel/",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/orochi235/weasel.git",
    "directory": "packages/font"
  },
  "bugs": {
    "url": "https://github.com/orochi235/weasel/issues"
  },
  "engines": {
    "node": ">=20"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public"
  }
}
```

- [ ] **Step 2: Create the tsup config**

`packages/font/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

export default defineConfig(
  packagePreset({
    entry: { index: 'src/index.ts' },
  }),
);
```

The preset sets `splitting: true`. Do not turn it off — with splitting disabled, a module-level registry reachable from two entries becomes two instances, which is exactly the bug this package is meant to make impossible. (This package has one entry today, so splitting is moot; the hazard returns the moment a second entry is added.)

- [ ] **Step 3: Create a placeholder barrel**

`packages/font/src/index.ts`:

```ts
// Barrel filled in by Task 2, when the glyph tier moves in.
export {};
```

- [ ] **Step 4: Add the tsconfig path mapping**

In the root `tsconfig.json` `paths` block, after the `@weasel-js/geom/*` entries, add:

```json
      "@weasel-js/font": ["./packages/font/src/index.ts"],
```

This list is hand-maintained (unlike `scripts/vite-aliases.ts`, which reads `packages/` at config-load time). A missing entry makes `npm run typecheck` silently depend on a prior `npm run build`.

- [ ] **Step 5: Add the package to the leaf build**

In the root `package.json`, extend `build:leaves`:

```json
    "build:leaves": "npm run build -w @weasel-js/geom -w @weasel-js/gestures -w @weasel-js/history -w @weasel-js/modes -w @weasel-js/theme -w @weasel-js/font",
```

- [ ] **Step 6: Install the workspace**

Run: `npm install`
Expected: completes, and `node_modules/@weasel-js/font` exists as a symlink to `packages/font`.

Verify: `ls -l node_modules/@weasel-js/font`
Expected: a symlink pointing at `../../packages/font`.

- [ ] **Step 7: Verify it builds**

Run: `npm run build -w @weasel-js/font`
Expected: PASS — `packages/font/dist/index.js` and `index.d.ts` written.

- [ ] **Step 8: Commit**

```bash
git add packages/font/package.json packages/font/tsup.config.ts packages/font/src/index.ts tsconfig.json package.json package-lock.json
git commit -m "build(font): scaffold @weasel-js/font as a Tier A leaf"
```

---

## Task 2: Move the glyph tier

This task is deliberately atomic. `registerFont.ts` imports `isCanvasFont`/`getDynamicFace` from `dynamic/dynamicAtlas.ts`, and `dynamicAtlas.ts` imports types back from `FontAtlas.ts` — moving them one commit at a time would mean a mid-flight state where the leaf imports core, which is the invariant this whole package exists to establish.

**Files:**
- Move: 11 source files + 6 test files (table in File Structure above)
- Create: `packages/font/src/textureSink.ts`
- Modify: `packages/font/src/index.ts`

- [ ] **Step 1: Move the files with `git mv`**

```bash
git mv packages/core/src/features/text/atlas/FontAtlas.ts packages/font/src/FontAtlas.ts
git mv packages/core/src/features/text/atlas/FontAtlas.test.ts packages/font/src/FontAtlas.test.ts
git mv packages/core/src/features/text/atlas/GlyphLayout.ts packages/font/src/GlyphLayout.ts
git mv packages/core/src/features/text/atlas/GlyphLayout.test.ts packages/font/src/GlyphLayout.test.ts
git mv packages/core/src/features/text/atlas/registerFont.ts packages/font/src/registerFont.ts
git mv packages/core/src/features/text/atlas/registerFont.test.ts packages/font/src/registerFont.test.ts
git mv packages/core/src/features/text/atlas/genFontSmoke.test.ts packages/font/src/genFontSmoke.test.ts
mkdir -p packages/font/src/dynamic
git mv packages/core/src/features/text/dynamic packages/font/src/dynamic
git mv packages/core/src/renderer/shaders/textSdf.ts packages/font/src/textSdf.ts
```

Note `packages/core/src/features/text/atlas/` still holds `layoutRuns.ts` and `layoutRuns.test.ts` — that directory does **not** get deleted.

- [ ] **Step 2: Create the texture seam**

`packages/font/src/textureSink.ts`:

```ts
/**
 * The only thing the glyph tier needs from a GL texture cache. Core's
 * `GLTextureCache` satisfies this structurally — there is no adapter and no
 * registration step, because the type *is* the seam.
 *
 * Declared here rather than imported so this package has zero reach-back into
 * core. If core's cache ever drops one of these methods, the failure surfaces
 * as a type error at the call site in `renderer/draw.ts`, which is where it
 * belongs.
 */

/** Anything WebGL can upload as a texture. */
export type TexSource = HTMLImageElement | ImageBitmap | ImageData | HTMLCanvasElement;

export interface GlyphTextureSink {
  has(id: string): boolean;
  upload(id: string, source: TexSource): string;
  uploadR8(id: string, width: number, height: number, data: Uint8Array): void;
  subImageR8(id: string, x: number, y: number, w: number, h: number, data: Uint8Array): void;
}
```

- [ ] **Step 3: Repoint the moved files' imports**

Three edits, all mechanical:

In `packages/font/src/registerFont.ts`, replace:

```ts
import type { GLTextureCache } from '../../../renderer/cache/GLTextureCache';
import { isCanvasFont, getDynamicFace, type DynamicFace } from '../dynamic/dynamicAtlas';
```

with:

```ts
import type { GlyphTextureSink } from './textureSink';
import { isCanvasFont, getDynamicFace, type DynamicFace } from './dynamic/dynamicAtlas';
```

…and change the one usage, in `ensureFontTexture`'s signature:

```ts
export function ensureFontTexture(
  family: string,
  weight: number,
  style: FontStyle,
  textureCache: GlyphTextureSink,
): boolean {
```

In `packages/font/src/dynamic/dynamicAtlas.ts`, replace:

```ts
import type { BmFont, BmFontChar } from '../atlas/FontAtlas';
import type { GLTextureCache } from '../../../renderer/cache/GLTextureCache';
```

with:

```ts
import type { BmFont, BmFontChar } from '../FontAtlas';
import type { GlyphTextureSink } from '../textureSink';
```

…and change the two `GLTextureCache` usages in that file to `GlyphTextureSink`:

```ts
const uploadedVersions = new WeakMap<GlyphTextureSink, Map<number, number>>();

export function syncDynamicPageTexture(cache: GlyphTextureSink, pageIndex: number): boolean {
```

- [ ] **Step 4: Rename the context-restore hook**

In `packages/font/src/registerFont.ts`, the underscore marked this as core-internal. It now crosses a package boundary:

```ts
/** Kept as a no-op for context-restore call sites; per-cache dedup handles it now. */
export function markAllFontsNotUploaded(): void {}
```

- [ ] **Step 5: Fix test imports in the moved tests**

The moved tests import their subjects by relative path. Update each to the new depth — e.g. in `packages/font/src/dynamic/dynamicAtlas.test.ts`, an import of `'../atlas/FontAtlas'` becomes `'../FontAtlas'`. Run the search to find every one:

Run: `grep -rn "\.\./atlas/\|\.\./\.\./\.\./renderer\|features/text" packages/font/src`
Expected: no output once all are fixed. Any hit is a stale path.

- [ ] **Step 6: Fill in the barrel**

`packages/font/src/index.ts`:

```ts
export { parseBmFont, FIXTURE_FONT } from './FontAtlas';
export type { BmFont, BmFontChar, BmFontInfo, BmFontCommon, BmFontKerning } from './FontAtlas';

export { layoutGlyphs, quadsToVertexBuffer, buildQuadIndexBuffer } from './GlyphLayout';
export type { GlyphQuad, GlyphLayoutStyle, GlyphLayoutOrigin } from './GlyphLayout';

export {
  registerFont,
  getFont,
  ensureFontTexture,
  textureCacheKey,
  markAllFontsNotUploaded,
  resolveFontVariant,
  _resetFontRegistryForTests,
} from './registerFont';
export type { FontEntry, FontVariant, ResolveResult } from './registerFont';

export {
  registerCanvasFont,
  unregisterCanvasFont,
  isCanvasFont,
  getDynamicFace,
  subscribeGlyphReady,
  syncDynamicPageTexture,
  dynamicPageTextureId,
  resetBakeBudget,
  PAGE_SIZE,
  MAX_PAGES,
  SDF_RADIUS,
  SDF_CUTOFF,
  DEFAULT_BAKE_BUDGET,
  _getPagesForTests,
  _resetDynamicFontsForTests,
  __setGlyphRasterizerForTests,
} from './dynamic/dynamicAtlas';
export type { DynamicFace } from './dynamic/dynamicAtlas';

export type { GlyphTextureSink, TexSource } from './textureSink';
export {
  TEXT_VERT_SRC,
  TEXT_FRAG_SRC,
  TEXT_FRAG_R8_SRC,
  TEXT_SDF_UNIFORMS,
  TEXT_SDF_ATTRIBUTES,
} from './textSdf';
```

Two of those exports look wrong and aren't. **`FIXTURE_FONT` and the
`_`-prefixed test helpers must be in the barrel**, because core's own tests use
them across the package boundary: `packages/core/src/renderer/draw.test.ts`
imports `FIXTURE_FONT`, `registerCanvasFont`, `_resetDynamicFontsForTests`, and
`__setGlyphRasterizerForTests`, and `measureTextBounds.test.ts` imports
`FIXTURE_FONT`. A test-only export that crosses a package boundary is still an
export. Leave the underscores on — they mark intent even though the barrel
carries them.

- [ ] **Step 7: Run the moved tests**

Run: `npx vitest run --project=weasel-ui packages/font`
Expected: PASS — every moved test, unchanged in substance. If a test needed a *behavioral* edit to pass, stop: the move changed something it shouldn't have.

- [ ] **Step 8: Commit**

```bash
git add packages/font/src package.json
git commit -m "refactor(font): move the glyph tier into @weasel-js/font

FontAtlas, GlyphLayout, registerFont, dynamic/, and the SDF shader source
move as a unit — registerFont and dynamicAtlas import each other, so a
staged move would leave the leaf importing core mid-flight.

GLTextureCache becomes the structural GlyphTextureSink; core's class
satisfies it with no adapter. _markAllFontsNotUploaded loses its
underscore now that it is a cross-package call."
```

Core does not compile at this point — Task 3 fixes it. That is expected and is why these two tasks are adjacent.

---

## Task 3: Repoint core

**Files:**
- Modify: `packages/core/package.json`, `packages/core/src/features/text/atlas/layoutRuns.ts`, `packages/core/src/features/text/measureTextBounds.ts`, `packages/core/src/renderer/draw.ts`, `packages/core/src/renderer/WeaselRenderer.ts`, `packages/core/src/renderer/index.ts`, `packages/core/src/canvas/SceneCanvas.tsx`

- [ ] **Step 1: Declare the dependency**

In `packages/core/package.json`, add to `dependencies` (keep the list alphabetical):

```json
    "@weasel-js/font": "0.6.0",
```

- [ ] **Step 2: Repoint every import**

Run: `grep -rn "features/text/atlas/registerFont\|features/text/atlas/FontAtlas\|features/text/atlas/GlyphLayout\|features/text/dynamic\|shaders/textSdf" packages/core/src`

Rewrite each hit to import from `@weasel-js/font`. The known set:

| File | Change |
| --- | --- |
| `features/text/atlas/layoutRuns.ts` | `import { resolveFontVariant, type ResolveResult, type BmFontChar, type BmFont } from '@weasel-js/font';` |
| `renderer/draw.ts` | `import { ensureFontTexture, textureCacheKey, syncDynamicPageTexture, dynamicPageTextureId } from '@weasel-js/font';` |
| `renderer/WeaselRenderer.ts` | `import { markAllFontsNotUploaded, resetBakeBudget, DEFAULT_BAKE_BUDGET, TEXT_VERT_SRC, TEXT_FRAG_SRC, TEXT_FRAG_R8_SRC, TEXT_SDF_UNIFORMS, TEXT_SDF_ATTRIBUTES } from '@weasel-js/font';` |
| `renderer/index.ts` | re-export `registerFont`, `registerCanvasFont`, `unregisterCanvasFont`, `subscribeGlyphReady` from `'@weasel-js/font'` |
| `index.ts` | same four re-exports (core's top-level barrel carries them too — see lines ~984) |
| `canvas/SceneCanvas.tsx` | `import { subscribeGlyphReady } from '@weasel-js/font';` |
| `renderer/draw.test.ts` | `FIXTURE_FONT`, `registerCanvasFont`, `_resetDynamicFontsForTests`, `__setGlyphRasterizerForTests` → `@weasel-js/font` |
| `features/text/measureTextBounds.test.ts` | `FIXTURE_FONT` → `@weasel-js/font` |

Note `features/text/measureTextBounds.ts` itself needs **no** change — it
imports `./atlas/layoutRuns`, which stays in core. Only its test touches the
font package.

- [ ] **Step 3: Update the call site of the renamed function**

In `packages/core/src/renderer/WeaselRenderer.ts`, the context-restore path calls `_markAllFontsNotUploaded()`. It becomes:

```ts
    markAllFontsNotUploaded();
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS with no errors. A "cannot find module '@weasel-js/font'" here means Task 1 Step 4's tsconfig path is missing or misspelled.

- [ ] **Step 5: Run the full kit suite**

Run: `npm run test:kit`
Expected: PASS. The GL text path is exercised through `renderer/draw` tests; `layoutRuns.test.ts` stayed in core and must still pass against the cross-package `resolveFontVariant`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/package.json packages/core/src package-lock.json
git commit -m "refactor(core): consume @weasel-js/font for the glyph tier"
```

---

## Task 4: Repoint hud and the font generator

**Files:**
- Modify: `packages/hud/package.json`, `packages/hud/src/fonts/registerDefaultFont.ts`, root `package.json`
- Move: `scripts/gen-font.ts`, `scripts/msdf-bmfont-xml.d.ts`

- [ ] **Step 1: Repoint hud's import**

`packages/hud/src/fonts/registerDefaultFont.ts` line 1 currently reads:

```ts
import { registerFont } from '@weasel-js/core/renderer';
```

Change to:

```ts
import { registerFont } from '@weasel-js/font';
```

The `?url` asset imports below it are untouched — hud stays Tier C (Vite library build) and the font package ships no assets.

- [ ] **Step 2: Declare hud's dependency**

In `packages/hud/package.json`, add to `dependencies` alongside `@weasel-js/theme`:

```json
    "@weasel-js/font": "0.6.0",
```

- [ ] **Step 3: Move the generator into the package it generates for**

```bash
mkdir -p packages/font/scripts
git mv scripts/gen-font.ts packages/font/scripts/gen-font.ts
git mv scripts/msdf-bmfont-xml.d.ts packages/font/scripts/msdf-bmfont-xml.d.ts
```

- [ ] **Step 4: Keep the command name stable**

In the root `package.json`, update the script so `npm run gen:font` still works:

```json
    "gen:font": "node packages/font/scripts/gen-font.ts",
```

- [ ] **Step 5: Verify the generator still resolves**

Run: `npm run gen:font -- --help` (or run it with no arguments and read the usage error)
Expected: the script loads and reports its own usage — not a module-resolution failure. If `gen-font.ts` imports anything by relative path from `scripts/`, fix those paths now.

- [ ] **Step 6: Install and typecheck**

Run: `npm install && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/hud/package.json packages/hud/src/fonts/registerDefaultFont.ts packages/font/scripts package.json package-lock.json
git commit -m "refactor(hud): register fonts through @weasel-js/font

Also moves gen-font into the package it generates for; npm run gen:font
is unchanged."
```

---

## Task 5: Guard the leaf invariant

The whole design rests on "this package does not import core." Nothing enforces that today for any leaf — the tiered build catches it indirectly, as a confusing module-resolution error. Make it a legible test failure instead.

**Files:**
- Create: `packages/font/src/leaf-purity.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/font/src/leaf-purity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `@weasel-js/font` is a Tier A leaf: core depends on it, never the reverse.
 * A reach-back would be a dependency cycle that the bundler resolves by
 * duplicating a module — and a duplicated font registry renders no glyphs at
 * all. Assert it structurally rather than trusting review.
 */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(path);
  }
  return out;
}

describe('leaf purity', () => {
  it('imports nothing from @weasel-js/core or core-internal aliases', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(import.meta.dirname, '.'))) {
      const src = readFileSync(file, 'utf8');
      // Bare `@weasel-js/core`, and core's internal path aliases
      // (`core/...`, `features/...`, `affordances/...`) which resolve only
      // inside core's tsconfig.
      if (/from ['"]@weasel-js\/core/.test(src) ||
          /from ['"](core|features|affordances)\//.test(src)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to confirm it passes for the right reason**

Run: `npx vitest run --project=weasel-ui packages/font/src/leaf-purity.test.ts`
Expected: PASS.

Then confirm it can actually fail: temporarily add `import type { FillStyle } from 'core/paint-types';` to `packages/font/src/FontAtlas.ts`, re-run, and expect FAIL listing that file. **Remove the temporary import.** A guard that cannot fail is not a guard.

- [ ] **Step 3: Commit**

```bash
git add packages/font/src/leaf-purity.test.ts
git commit -m "test(font): assert the leaf never imports core"
```

---

## Task 6: Report substitution structurally

The first of three behavior tasks. Today an unregistered family reaches `missResolveResult` and returns `entry: null` — no glyphs, console-only warning. This task adds the *reporting* field and the `'substitute'` resolution, which is the new default.

**Files:**
- Create: `packages/font/src/fallback.ts`
- Modify: `packages/font/src/registerFont.ts`, `packages/font/src/index.ts`
- Test: `packages/font/src/fallback.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/font/src/fallback.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveFontVariant, getFont, _resetFontRegistryForTests } from './registerFont';
import { setDefaultFontFamily, setFontFallbackPolicy, _resetFallbackForTests } from './fallback';
import { registerTestFont } from './testing/registerTestFont';

beforeEach(() => {
  _resetFontRegistryForTests();
  _resetFallbackForTests();
});

describe('substitute policy', () => {
  it('resolves an unregistered family to the default family', () => {
    registerTestFont('Inter', 400, 'normal');
    setDefaultFontFamily('Inter');

    const result = resolveFontVariant('Comic Sans', 400, 'normal');

    expect(result.entry).toBe(getFont('Inter', 400, 'normal'));
    expect(result.substituted).toEqual({ requested: 'Comic Sans', resolved: 'Inter' });
  });

  it('leaves substituted undefined when the requested family resolves', () => {
    registerTestFont('Inter', 400, 'normal');

    const result = resolveFontVariant('Inter', 400, 'normal');

    expect(result.entry).not.toBeNull();
    expect(result.substituted).toBeUndefined();
  });

  it('defaults the default family to the first registered family', () => {
    registerTestFont('Roboto', 400, 'normal');
    registerTestFont('Inter', 400, 'normal');

    const result = resolveFontVariant('Nothing', 400, 'normal');

    expect(result.substituted).toEqual({ requested: 'Nothing', resolved: 'Roboto' });
  });

  it('returns a miss when no family is registered at all', () => {
    const result = resolveFontVariant('Nothing', 400, 'normal');

    expect(result.entry).toBeNull();
    expect(result.substituted).toBeUndefined();
  });
});
```

- [ ] **Step 2: Write the test helper the test depends on**

`registerFont` fetches over the network, so tests stub `fetch` and
`createImageBitmap` and then call it for real. That pattern already exists
verbatim in `packages/core/src/renderer/draw.test.ts` (~line 296) and in the
moved `registerFont.test.ts`. Factor it out rather than inventing a second way
into the registry — a test-only injector would bypass exactly the code path
these tests exist to cover.

`packages/font/src/testing/registerTestFont.ts`:

```ts
import { vi } from 'vitest';
import { FIXTURE_FONT } from '../FontAtlas';
import { registerFont } from '../registerFont';

/**
 * Register the two-glyph fixture atlas under an arbitrary family/variant by
 * stubbing the network, not by reaching into the registry — the fetch/parse
 * path stays under test.
 *
 * Stubs `global.fetch` and `global.createImageBitmap` as a side effect. Call
 * from `beforeEach`; vitest's `restoreAllMocks` (or a manual restore) puts
 * them back.
 */
export async function registerTestFont(
  family: string,
  weight = 400,
  style: 'normal' | 'italic' = 'normal',
): Promise<void> {
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) });
    }
    return Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
    });
  }) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);

  await registerFont(family, { weight, style }, `/fonts/${family}.json`, `/fonts/${family}.png`);
}
```

Because this is async, every `registerTestFont` call in `fallback.test.ts` needs `await`, and the enclosing test callbacks become `async`. Update the Step 1 test body accordingly — e.g.:

```ts
  it('resolves an unregistered family to the default family', async () => {
    await registerTestFont('Inter', 400, 'normal');
    setDefaultFontFamily('Inter');
    // …unchanged from here
  });
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/font/src/fallback.test.ts`
Expected: FAIL — `Cannot find module './fallback'`.

- [ ] **Step 4: Write the fallback module**

`packages/font/src/fallback.ts`:

```ts
/**
 * Cross-family fallback policy. The per-family chain in `resolveFontVariant`
 * (weight → style → synthetic) has always been rich; what was missing is what
 * happens when the family itself was never registered. That case used to
 * render nothing at all, which is the single most common cause of "my text is
 * invisible".
 */

export type FontFallbackPolicy = 'substitute' | 'canvas' | 'none';

let policy: FontFallbackPolicy = 'substitute';
let defaultFamily: string | null = null;

export function setFontFallbackPolicy(next: FontFallbackPolicy): void {
  policy = next;
}

export function getFontFallbackPolicy(): FontFallbackPolicy {
  return policy;
}

/** Explicit default family for `'substitute'`. When unset, the first
 *  registered family wins — which is the right answer for the common case of
 *  an app that registers exactly one. */
export function setDefaultFontFamily(family: string): void {
  defaultFamily = family;
}

export function getDefaultFontFamily(): string | null {
  return defaultFamily;
}

/** Test helper. Do not call from product code. */
export function _resetFallbackForTests(): void {
  policy = 'substitute';
  defaultFamily = null;
}
```

- [ ] **Step 5: Wire substitution into the resolver**

In `packages/font/src/registerFont.ts`, add the field to `ResolveResult`:

```ts
  /**
   * Set when the requested family was not registered and the fallback policy
   * substituted a different one. Reported structurally so a UI can say
   * "Inter — not loaded, showing Roboto" instead of leaving the user to
   * wonder why the family control did nothing.
   */
  substituted?: { requested: string; resolved: string };
```

Then rewrite `missResolveResult` to consult the policy. It already handles the canvas tier for explicitly-registered canvas families; that branch stays first, because an explicit `registerCanvasFont` outranks any policy:

```ts
function missResolveResult(family: string, weight: number, style: FontStyle): ResolveResult {
  // Explicitly-registered canvas families resolve through the dynamic tier
  // regardless of policy — the consumer asked for it by name.
  if (isCanvasFont(family)) {
    return {
      entry: null,
      dynamicFace: getDynamicFace(family, weight, style),
      resolved: { weight, style },
      synthetic: { bold: false, italic: false },
      source: 'canvas',
    };
  }

  const policy = getFontFallbackPolicy();

  if (policy === 'substitute') {
    const fallback = getDefaultFontFamily() ?? firstRegisteredFamily();
    // Guard against recursing when the default family is itself missing.
    if (fallback !== null && fallback !== family && registry.has(fallback)) {
      const result = resolveFontVariant(fallback, weight, style);
      if (result.entry !== null) {
        warnMissingFamilyOnce(family, weight, style, fallback);
        return { ...result, substituted: { requested: family, resolved: fallback } };
      }
    }
  }

  return {
    entry: null,
    resolved: { weight, style },
    synthetic: { bold: false, italic: false },
    source: 'atlas',
  };
}

/** Insertion order of the registry Map — the first family an app registered. */
function firstRegisteredFamily(): string | null {
  for (const family of registry.keys()) return family;
  return null;
}
```

The `fallback !== family && registry.has(fallback)` guard matters: without it, a default family that is itself unregistered recurses until the stack blows.

- [ ] **Step 6: Add the warn-once helper**

Still in `registerFont.ts`, following the `warnedUniforms` once-pattern in core's `renderer/draw.ts` — resolution happens per frame, so an unguarded `console.warn` floods the console:

```ts
const warnedMissingFamilies = new Set<string>();

function warnMissingFamilyOnce(
  family: string, weight: number, style: FontStyle, resolved: string,
): void {
  const key = `${family}|${weight}|${style}`;
  if (warnedMissingFamilies.has(key)) return;
  warnedMissingFamilies.add(key);
  console.warn(
    `weasel: font family "${family}" (${weight}/${style}) is not registered — ` +
    `rendering with "${resolved}" instead. Advance widths will differ from the ` +
    `requested font. Call registerFont("${family}", …) or setFontFallbackPolicy('none') ` +
    `to make this a hard miss.`,
  );
}
```

Add `warnedMissingFamilies.clear()` to the body of `_resetFontRegistryForTests`, so warn-once state doesn't leak between tests.

- [ ] **Step 7: Export the new surface**

Add to `packages/font/src/index.ts`:

```ts
export {
  setFontFallbackPolicy,
  getFontFallbackPolicy,
  setDefaultFontFamily,
  getDefaultFontFamily,
} from './fallback';
export type { FontFallbackPolicy } from './fallback';
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run --project=weasel-ui packages/font`
Expected: PASS — the new `fallback.test.ts` plus every moved test still green.

- [ ] **Step 9: Commit**

```bash
git add packages/font/src
git commit -m "feat(font): substitute the default family for unregistered fonts

Reported structurally via ResolveResult.substituted, not just to the
console, so a UI can surface the substitution. Warn-once per variant."
```

---

## Task 7: The `'canvas'` and `'none'` policies

**Files:**
- Modify: `packages/font/src/registerFont.ts`
- Test: `packages/font/src/fallback.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/font/src/fallback.test.ts`:

```ts
describe('canvas policy', () => {
  it('auto-registers an unknown family with the dynamic rasterizer', () => {
    setFontFallbackPolicy('canvas');

    const result = resolveFontVariant('Helvetica Neue', 400, 'normal');

    expect(result.source).toBe('canvas');
    expect(result.dynamicFace).toBeDefined();
    expect(result.substituted).toBeUndefined();
  });
});

describe('none policy', () => {
  it('reproduces a hard miss', () => {
    registerTestFont('Inter', 400, 'normal');
    setDefaultFontFamily('Inter');
    setFontFallbackPolicy('none');

    const result = resolveFontVariant('Comic Sans', 400, 'normal');

    expect(result.entry).toBeNull();
    expect(result.substituted).toBeUndefined();
    expect(result.source).toBe('atlas');
  });
});

describe('warn-once', () => {
  it('warns once per (family, weight, style)', () => {
    registerTestFont('Inter', 400, 'normal');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    resolveFontVariant('Comic Sans', 400, 'normal');
    resolveFontVariant('Comic Sans', 400, 'normal');
    resolveFontVariant('Comic Sans', 700, 'normal');

    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
```

Add `vi` to the vitest import at the top of the file.

- [ ] **Step 2: Run to verify the canvas test fails**

Run: `npx vitest run --project=weasel-ui packages/font/src/fallback.test.ts`
Expected: FAIL on the canvas case — `source` is `'atlas'`, `dynamicFace` undefined. The `'none'` and warn-once cases should already pass from Task 6.

- [ ] **Step 3: Implement the canvas branch**

In `missResolveResult`, after the explicit-canvas-family branch and before the `'substitute'` branch:

```ts
  if (policy === 'canvas') {
    // Auto-enroll: the browser probably has this family even though no atlas
    // was baked for it. Real typeface, canvas-SDF quality.
    registerCanvasFont(family);
    return {
      entry: null,
      dynamicFace: getDynamicFace(family, weight, style),
      resolved: { weight, style },
      synthetic: { bold: false, italic: false },
      source: 'canvas',
    };
  }
```

Add `registerCanvasFont` to the existing import from `./dynamic/dynamicAtlas`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project=weasel-ui packages/font`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/font/src
git commit -m "feat(font): canvas and none fallback policies"
```

---

## Task 8: `listFonts()`

**Files:**
- Modify: `packages/font/src/registerFont.ts`, `packages/font/src/index.ts`
- Test: `packages/font/src/registerFont.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/font/src/registerFont.test.ts` (import `listFonts` and the fixture helper at the top):

```ts
describe('listFonts', () => {
  it('reports each registered family with its variants', () => {
    registerTestFont('Inter', 400, 'normal');
    registerTestFont('Inter', 700, 'normal');
    registerTestFont('Roboto', 400, 'italic');

    expect(listFonts()).toEqual([
      { family: 'Inter', variants: [{ weight: 400, style: 'normal' }, { weight: 700, style: 'normal' }] },
      { family: 'Roboto', variants: [{ weight: 400, style: 'italic' }] },
    ]);
  });

  it('is empty before anything registers', () => {
    expect(listFonts()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/font/src/registerFont.test.ts`
Expected: FAIL — `listFonts is not a function`.

- [ ] **Step 3: Implement**

In `packages/font/src/registerFont.ts`:

```ts
export interface RegisteredFont {
  family: string;
  variants: readonly { weight: number; style: FontStyle }[];
}

/**
 * Enumerate the registry — what a font picker can honestly offer. Families
 * come back in registration order; variants sorted by weight, then style, so
 * the output is stable enough to assert against.
 */
export function listFonts(): readonly RegisteredFont[] {
  const out: RegisteredFont[] = [];
  for (const [family, variantMap] of registry) {
    const variants = [...variantMap.keys()]
      .map((key) => {
        const [w, s] = key.split('|') as [string, FontStyle];
        return { weight: Number(w), style: s };
      })
      .sort((a, b) => a.weight - b.weight || a.style.localeCompare(b.style));
    out.push({ family, variants });
  }
  return out;
}
```

- [ ] **Step 4: Export it**

Add `listFonts` and `type RegisteredFont` to the `./registerFont` export block in `packages/font/src/index.ts`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run --project=weasel-ui packages/font`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/font/src
git commit -m "feat(font): listFonts() enumerates the registry"
```

---

## Task 9: Extend the duplicate-copy canary

`scripts/smoke-consumer-bundle.mjs` imports `registerFont` from both `weasel-js/renderer` and `@weasel-js/core/renderer` and asserts esbuild doesn't bundle two copies — the comment says "two copies means two React hook instances and two font registries." After the move, `registerFont` resolves *through* core's re-export into `@weasel-js/font`, so that assertion silently starts proving something weaker unless it also covers the new package directly.

**Files:**
- Modify: `scripts/smoke-consumer-bundle.mjs`

- [ ] **Step 1: Read the existing canary**

Run: `grep -n "registerFont" -B 8 -A 8 scripts/smoke-consumer-bundle.mjs`

The fixture source is assembled as a string around line 255. Read the surrounding duplicate-detection logic before editing so the new import follows the same shape.

- [ ] **Step 2: Add the direct import to the fixture**

Extend the generated fixture source so it also imports the registry from the package that now owns it:

```js
    `import { registerFont as directFont } from '@weasel-js/font';\n` +
```

…and add `directFont` to the existing `void` statement that keeps the imports live:

```js
    `void AliasCanvas; void CoreCanvas; void aliasFont; void coreFont; void directFont;\n` +
```

- [ ] **Step 3: Run the smoke test**

Run: `npm run test:smoke:consumer`
Expected: PASS — one copy of `@weasel-js/font` in the bundle. A failure here means core is inlining the leaf instead of externalizing it; check that `@weasel-js/font` is in core's `dependencies` (Task 3 Step 1), since tsup derives its external list from deps + peerDeps.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-consumer-bundle.mjs
git commit -m "test(smoke): assert @weasel-js/font resolves to a single copy"
```

---

## Task 10: Release wiring

**Files:**
- Modify: `.changeset/config.json`
- Create: `.changeset/font-package-extraction.md`

- [ ] **Step 1: Add the package to the lockstep group**

In `.changeset/config.json`, add `"@weasel-js/font"` to the `fixed` array. Order within the array doesn't matter; keep it next to the other leaves for readability:

```json
  "fixed": [
    [
      "@weasel-js/core",
      "@weasel-js/font",
      "@weasel-js/geom",
      "@weasel-js/gestures",
      "@weasel-js/history",
      "@weasel-js/modes",
      "@weasel-js/svg",
      "@weasel-js/d3",
      "@weasel-js/theme",
      "@weasel-js/ui",
      "@weasel-js/hud",
      "weasel-js"
    ]
  ],
```

Omitting this is the one packaging mistake that stays invisible until a consumer installs mismatched pins.

- [ ] **Step 2: Write the changeset**

`.changeset/font-package-extraction.md` — a `minor` on any member takes the whole fixed group from `0.6.0` to `0.7.0`:

```markdown
---
"@weasel-js/core": minor
"@weasel-js/font": minor
"@weasel-js/hud": minor
---

Extract the MSDF glyph tier into a new `@weasel-js/font` package: font
registry, atlas parsing, glyph layout, runtime rasterization, and the SDF
text shader source. `@weasel-js/core` depends on it; `registerFont` is still
re-exported from `@weasel-js/core/renderer`, so existing call sites keep
working.

Unregistered font families now render in the default family with a one-time
warning instead of rendering nothing. Configure with
`setFontFallbackPolicy('substitute' | 'canvas' | 'none')` — `'none'`
restores the previous hard-miss behavior. `ResolveResult.substituted`
reports the substitution structurally.

Adds `listFonts()` for enumerating registered families.
```

- [ ] **Step 3: Verify the bump resolves as intended**

Run: `npx changeset status`
Expected: every package in the fixed group listed at `0.7.0`. If `@weasel-js/font` shows a different version than the rest, Step 1 didn't take.

Do **not** run `changeset version` or `changeset publish` — versioning happens at release time, not here.

- [ ] **Step 4: Commit**

```bash
git add .changeset/config.json .changeset/font-package-extraction.md
git commit -m "chore(release): font joins the lockstep group; 0.7.0 minor"
```

---

## Task 11: Documentation sweep

**Files:**
- Create: `packages/font/README.md`
- Modify: `packages/core/src/features/text/README.md`, `docs/TODO.md`, `README.md`

- [ ] **Step 1: Write the package README**

`packages/font/README.md`:

```markdown
# @weasel-js/font

MSDF font atlases, glyph metrics, and runtime glyph rasterization for
`@weasel-js/core`.

A Tier A leaf: core depends on this package, never the reverse. It owns the
font registry — the one piece of module-level state whose duplication renders
no glyphs at all.

## What's here

| Module | Role |
| --- | --- |
| `FontAtlas` | BMFont metrics parsing |
| `GlyphLayout` | Kerning-aware glyph walk |
| `registerFont` | The registry, variant resolution, texture upload |
| `dynamic/` | Runtime canvas-SDF rasterization for glyphs with no baked atlas |
| `textSdf` | Shader source for the SDF text program |

## Fallback

An unregistered family renders in the default family with a one-time warning:

```ts
setFontFallbackPolicy('substitute');  // default — render in the default family
setFontFallbackPolicy('canvas');      // rasterize the real typeface at runtime
setFontFallbackPolicy('none');        // hard miss: render nothing (pre-0.7 behavior)

setDefaultFontFamily('Inter');        // defaults to the first registered family
```

Substitution changes advance widths, so measurement and wrap differ from the
requested font. `ResolveResult.substituted` reports it structurally so a UI can
surface the swap rather than leaving it to the console.

## Generating an atlas

`npm run gen:font` (source in `scripts/gen-font.ts`).
```

- [ ] **Step 2: Update the text feature README**

`packages/core/src/features/text/README.md` currently warns that an unregistered family "renders a warning and **no glyphs** — that's the usual cause of 'my text is invisible.'" That is no longer true by default. Replace that blockquote with:

```markdown
> **The GL renderer uses MSDF text.** Font registration lives in
> `@weasel-js/font` (`registerFont(family, variant, metricsUrl, atlasUrl)`,
> re-exported from `@weasel-js/core/renderer`). An unregistered family now
> renders in the default family with a one-time warning; call
> `setFontFallbackPolicy('none')` to restore the old hard-miss behavior.
```

Also update the Subdirectories table: `atlas/` now holds only `layoutRuns`, and `dynamic/` is gone from core.

- [ ] **Step 3: Update the TODO**

In `docs/TODO.md`, the HarfBuzz item (§Text, P3) cites
`packages/core/src/features/text/atlas/GlyphLayout.ts`. Repoint it at
`packages/font/src/GlyphLayout.ts`. Grep for other stale paths:

Run: `grep -rn "features/text/atlas\|features/text/dynamic\|shaders/textSdf" docs/ README.md`
Expected: no hits outside the two spec files, which are historical records and stay as written.

- [ ] **Step 4: Commit**

```bash
git add packages/font/README.md packages/core/src/features/text/README.md docs/TODO.md README.md
git commit -m "docs(font): package README; correct the invisible-text warning"
```

---

## Task 12: Full green gate

- [ ] **Step 1: Run the release gate**

Run: `npm run typecheck && npm run test && npm run build && npm run check:manifests && npm run test:smoke:consumer`

This is exactly what `prepublishOnly` runs, and it's what CI gates on. Expected: PASS at every stage.

Note `npm run test` alone does **not** typecheck production code — that's why `typecheck` leads.

- [ ] **Step 2: Run the visual regression suite**

Run: `npm run test:visual`
Expected: PASS. Text rendering is covered by baselines; local capture has matched CI since the backing-store fix, so a failure here is real signal, not drift.

- [ ] **Step 3: Fix anything red, then re-run the gate**

Do not proceed with failures. If a visual baseline legitimately changed (it shouldn't — this task set changes no rendering geometry), stop and report rather than running `test:visual:update`.

- [ ] **Step 4: Final commit if anything changed**

```bash
git add -u
git commit -m "chore: green gate for the font extraction"
```

(`git add -u` stages only already-tracked modifications; still avoid `git add -A`.)

---

## Done means

- `packages/font` exists as a published-shaped Tier A leaf at `0.6.0`, in the changeset fixed group, bumping to `0.7.0` on release.
- `grep -rn "@weasel-js/core" packages/font/src` returns nothing, and a test enforces it.
- Every moved test passes without behavioral edits.
- An unregistered font family renders in the default family and says so once, and `setFontFallbackPolicy('none')` restores the old behavior.
- `npm run gen:font` still works from the repo root.
- The full `prepublishOnly` gate is green.
