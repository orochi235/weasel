# `@weasel-js/cursor` Arc 1 — Baked Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `@weasel-js/cursor` package that turns an authored glyph into a real CSS `url()` cursor string, and put pencil, pen, bucket and eyedropper cursors on the tools that currently show a bare `crosshair`.

**Architecture:** A glyph is SVG path `d` strings tagged with a paint role plus a hotspot in glyph units. `bakeCursor` renders one to a `url("data:image/svg+xml,…") hx hy, fallback` string; a memoized `cursorFor(name, opts)` wraps it. Glyph geometry is authored as computed `.mjs` and generated to resolved literals, mirroring `gen:icons`. No `core` dependency — this is a leaf package in the shape of `@weasel-js/loupe`.

**Tech Stack:** TypeScript, tsup (via `scripts/tsup-preset`), vitest (`weasel-ui` project), resvg for headless glyph proofs.

**Spec:** `docs/superpowers/specs/2026-09-03-cursor-system-design.md`

**Out of scope for this arc:** rotation (arc 2), the painted tier and `CursorSpec` (arc 3), the `apps/draw` CSS stub (arc 4).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/cursor/package.json` | Manifest. Leaf package, no `@weasel-js` deps. |
| `packages/cursor/tsconfig.json` | Extends root; `noEmit`. |
| `packages/cursor/tsup.config.ts` | One entry via `packagePreset`. |
| `packages/cursor/src/types.ts` | `CursorGlyph`, `CursorPath`, register constants. |
| `packages/cursor/src/bake.ts` | Glyph + size → CSS cursor string. Pure. |
| `packages/cursor/src/registry.ts` | `GLYPHS` lookup + memoized `cursorFor`. |
| `packages/cursor/src/glyphs.ts` | **GENERATED** from `scripts/glyphs/`. |
| `packages/cursor/src/index.ts` | Barrel. |
| `packages/cursor/scripts/glyphs/draw.mjs` | Authored geometry: pencil, pen, bucket, eyedropper. |
| `packages/cursor/scripts/gen-cursors.mjs` | Emits `src/glyphs.ts`. |
| `packages/cursor/scripts/proof-cursors.mjs` | Headless resvg proof sheet. |
| `packages/cursor/scripts/probe/` | The headful browser measurement harness. |

Tests sit beside their subject as `*.test.ts` and run under the **`weasel-ui`** vitest project — `packages/**/*.test.{ts,tsx}` minus `labkit` and `core`. Not the `kit` project, which is core-only.

**Commands used throughout:**

- Test this package: `npx vitest run --project=weasel-ui packages/cursor`
- Typecheck: `npx tsc --noEmit` (from repo root, always)
- Manifest check: `npm run check:manifests`

---

### Task 1: Scaffold the package

**Files:**
- Create: `packages/cursor/package.json`
- Create: `packages/cursor/tsconfig.json`
- Create: `packages/cursor/tsup.config.ts`
- Create: `packages/cursor/src/index.ts`
- Modify: `.changeset/config.json`
- Modify: `package.json` (root, `build:leaves`)

- [ ] **Step 1: Write the manifest**

Version `1.3.0` matches every other package — they are one changesets `fixed` group and move in lockstep.

`packages/cursor/package.json`:

```json
{
  "name": "@weasel-js/cursor",
  "version": "1.3.0",
  "description": "Tool cursors as authored glyphs: bake one to a CSS url() cursor string, or paint it when it is too big to be one.",
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
  "author": "orochi235",
  "homepage": "https://orochi235.github.io/weasel/",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/orochi235/weasel.git",
    "directory": "packages/cursor"
  },
  "bugs": {
    "url": "https://github.com/orochi235/weasel/issues"
  },
  "engines": {
    "node": ">=22"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsup"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

- [ ] **Step 2: Write tsconfig and tsup config**

`packages/cursor/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "include": ["src"],
  "compilerOptions": {
    "rootDir": "src",
    "noEmit": true
  }
}
```

`packages/cursor/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';
import { packagePreset } from '../../scripts/tsup-preset';

export default defineConfig(packagePreset({ entry: { index: 'src/index.ts' } }));
```

- [ ] **Step 3: Add a placeholder barrel**

`packages/cursor/src/index.ts`:

```ts
export {};
```

- [ ] **Step 4: Register the package in the fixed group and the build**

In `.changeset/config.json`, add `"@weasel-js/cursor"` to the single array inside `"fixed"`. Omitting it breaks lockstep versioning.

In the root `package.json`, add `-w @weasel-js/cursor` to the end of the `build:leaves` script. It is a leaf: nothing in it imports another workspace package.

- [ ] **Step 5: Install and verify the workspace resolves**

Run: `npm install`
Expected: exits 0, and `ls node_modules/@weasel-js/cursor` shows a symlink into `packages/cursor`.

Vite/vitest aliases need no edit — `scripts/vite-aliases.ts` reads `packages/` at config-load time, so a new directory is picked up automatically.

- [ ] **Step 6: Verify the manifest check passes**

Run: `npm run build -w @weasel-js/cursor && npm run check:manifests`
Expected: both exit 0. This proves `exports` points at files `npm pack` will really include.

- [ ] **Step 7: Commit**

```bash
git add packages/cursor .changeset/config.json package.json package-lock.json
git commit -m "scaffold the cursor package as a leaf workspace"
```

---

### Task 2: The glyph record type

**Files:**
- Create: `packages/cursor/src/types.ts`
- Test: `packages/cursor/src/types.test.ts`

- [ ] **Step 1: Write the failing test**

The only behavior worth asserting here is that the halo bleed fits inside the box — an authored glyph whose halo is clipped by the viewBox looks fine large and loses its outline at cursor size, which is exactly the class of defect that survives every other check.

`packages/cursor/src/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CURSOR_HALO_WIDTH, haloFitsInBox } from './types';
import type { CursorGlyph } from './types';

const glyph = (box: number, d: string): CursorGlyph => ({
  box,
  hotspot: [0, 0],
  paths: [{ role: 'ink', d }],
});

describe('haloFitsInBox', () => {
  it('accepts ink inset by more than half the halo stroke', () => {
    // Half of 2.6 is 1.3; this square sits 2 units off every edge.
    expect(haloFitsInBox(glyph(24, 'M 2 2 L 22 2 L 22 22 L 2 22 Z'))).toBe(true);
  });

  it('rejects ink whose halo would be clipped by the viewBox', () => {
    // Flush with the edge: the outer 1.3 units of halo fall outside the box.
    expect(haloFitsInBox(glyph(24, 'M 0 0 L 24 0 L 24 24 L 0 24 Z'))).toBe(false);
  });

  it('exposes the halo width the check is derived from', () => {
    expect(CURSOR_HALO_WIDTH).toBe(2.6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/cursor/src/types.test.ts`
Expected: FAIL — `Failed to resolve import "./types"`.

- [ ] **Step 3: Write the implementation**

`packages/cursor/src/types.ts`:

```ts
/**
 * A cursor glyph: SVG path `d` strings tagged with a paint role, plus the
 * hotspot in glyph units. The same record feeds both the data-URI baker and
 * the Path2D painter, so `d` is the one geometry form neither has to translate.
 */
export interface CursorGlyph {
  /** Side of the square viewBox the paths are authored in. */
  readonly box: number;
  /** Hotspot in glyph units, scaled to integer CSS px at bake time. */
  readonly hotspot: readonly [number, number];
  readonly paths: readonly CursorPath[];
}

export type CursorPath =
  /** The silhouette. Filled in ink, stroked in halo behind the fill. */
  | { readonly role: 'ink'; readonly d: string }
  /** A division inside the silhouette, drawn in the halo color. */
  | { readonly role: 'detail'; readonly d: string; readonly width: number }
  /** A literal color, for glyphs that carry a swatch. */
  | { readonly role: 'accent'; readonly d: string; readonly fill: string };

/**
 * Ink and halo are constants of the register rather than parameters: a
 * self-contrasting glyph reads on white paper, dark chrome and mid-tone
 * artwork alike precisely because it does not track the theme.
 */
export const CURSOR_INK = '#141418';
export const CURSOR_HALO = '#ffffff';
export const CURSOR_HALO_WIDTH = 2.6;

/**
 * Chrome silently drops a cursor image above this size and falls back to the
 * keyword after the comma, with no error anywhere. Measured on Chrome 152 /
 * macOS 26.5; see the spec's "Measured browser behavior".
 */
export const CURSOR_MAX_CSS_PX = 128;

/** Every coordinate pair in a `d` string. Enough for the extent check; these
 *  are authored paths in a known dialect, not arbitrary user input. */
function coords(d: string): number[] {
  return (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/**
 * True when every authored coordinate sits at least half a halo stroke inside
 * the viewBox. A clipped halo is invisible at proof size and flattens the
 * glyph's outline at cursor size, so it is worth failing loudly at authoring
 * time rather than discovering it on a dark background.
 */
export function haloFitsInBox(glyph: CursorGlyph): boolean {
  const margin = CURSOR_HALO_WIDTH / 2;
  return glyph.paths.every((p) =>
    coords(p.d).every((v) => v >= margin && v <= glyph.box - margin),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/cursor/src/types.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/cursor/src/types.ts packages/cursor/src/types.test.ts
git commit -m "define the cursor glyph record and its halo-fit check"
```

---

### Task 3: Bake a glyph to a CSS cursor string

**Files:**
- Create: `packages/cursor/src/bake.ts`
- Test: `packages/cursor/src/bake.test.ts`

- [ ] **Step 1: Write the failing test**

Each case guards something that actually broke or was measured: hotspot scaling is real arithmetic, a raw `#` truncates the data URI at the fragment, a missing fallback keyword turns a rejected image into `auto`, and the size cap is the measured Chrome threshold.

`packages/cursor/src/bake.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { bakeCursor } from './bake';
import type { CursorGlyph } from './types';

const PENCIL: CursorGlyph = {
  box: 24,
  hotspot: [5, 19],
  paths: [
    { role: 'ink', d: 'M 5 19 L 7.5 16.5 L 16 8 L 19 11 L 10.5 19.5 L 8 19 Z' },
    { role: 'detail', d: 'M 14 6 L 19 11', width: 1.2 },
  ],
};

describe('bakeCursor', () => {
  it('scales the hotspot from glyph units to integer CSS px', () => {
    // box 24, hotspot (5,19), size 24 -> unchanged.
    expect(bakeCursor(PENCIL, { size: 24 })).toContain('") 5 19,');
    // Same glyph at 48 -> doubled.
    expect(bakeCursor(PENCIL, { size: 48 })).toContain('") 10 38,');
  });

  it('rounds a fractional hotspot rather than emitting a decimal', () => {
    // 5/24*30 = 6.25 -> 6;  19/24*30 = 23.75 -> 24.
    expect(bakeCursor(PENCIL, { size: 30 })).toContain('") 6 24,');
  });

  it('always ends in a keyword fallback', () => {
    // Without one, a rejected image leaves the element on `auto`, not on the
    // cursor the tool asked for.
    expect(bakeCursor(PENCIL, {})).toMatch(/, default$/);
    expect(bakeCursor(PENCIL, { fallback: 'crosshair' })).toMatch(/, crosshair$/);
  });

  it('percent-encodes the payload so no raw # reaches the URI', () => {
    // An unencoded '#' from a color starts a fragment and truncates the SVG.
    const css = bakeCursor(PENCIL, {});
    const uri = css.slice(css.indexOf('data:'), css.indexOf('")'));
    expect(uri).not.toContain('#');
    expect(decodeURIComponent(uri)).toContain('#141418');
  });

  it('paints the halo behind the fill on every ink path', () => {
    const svg = decodeURIComponent(bakeCursor(PENCIL, {}));
    expect(svg).toContain('paint-order="stroke fill"');
    expect(svg).toContain('stroke-width="2.6"');
  });

  it('declares the requested size on the svg element', () => {
    const svg = decodeURIComponent(bakeCursor(PENCIL, { size: 32 }));
    // For a cursor image, 1 image px == 1 CSS px, so the declared width IS the
    // rendered size. Nothing else controls it.
    expect(svg).toContain('width="32"');
    expect(svg).toContain('viewBox="0 0 24 24"');
  });

  it('throws above the measured Chrome cap instead of emitting a dud', () => {
    // Chrome drops the image silently at this size; a loud failure here is the
    // whole reason the painted tier exists.
    expect(() => bakeCursor(PENCIL, { size: 160 })).toThrow(/128/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/cursor/src/bake.test.ts`
Expected: FAIL — `Failed to resolve import "./bake"`.

- [ ] **Step 3: Write the implementation**

`packages/cursor/src/bake.ts`:

```ts
import {
  CURSOR_HALO,
  CURSOR_HALO_WIDTH,
  CURSOR_INK,
  CURSOR_MAX_CSS_PX,
} from './types';
import type { CursorGlyph, CursorPath } from './types';

export interface BakeOptions {
  /** Rendered size in CSS px. Default 24. */
  readonly size?: number;
  /** Keyword drawn if the browser rejects the image. Default 'default'. */
  readonly fallback?: string;
}

function renderPath(p: CursorPath): string {
  switch (p.role) {
    case 'ink':
      return (
        `<path d="${p.d}" fill="${CURSOR_INK}" stroke="${CURSOR_HALO}"` +
        ` stroke-width="${CURSOR_HALO_WIDTH}" stroke-linejoin="round"` +
        ` paint-order="stroke fill"/>`
      );
    case 'detail':
      return (
        `<path d="${p.d}" fill="none" stroke="${CURSOR_HALO}"` +
        ` stroke-width="${p.width}" stroke-linecap="round"/>`
      );
    case 'accent':
      return `<path d="${p.d}" fill="${p.fill}"/>`;
  }
}

/**
 * Render a glyph to a CSS cursor value.
 *
 * Ships SVG rather than a bitmap because Chrome rasterizes an SVG data-URI
 * cursor at device scale — it is already crisp on a retina display, so there
 * is no PNG pipeline and no `image-set()` here. See the spec.
 */
export function bakeCursor(glyph: CursorGlyph, opts: BakeOptions = {}): string {
  const size = opts.size ?? 24;
  if (size > CURSOR_MAX_CSS_PX) {
    throw new RangeError(
      `cursor size ${size} exceeds the ${CURSOR_MAX_CSS_PX}px cap: the browser ` +
        `would drop the image and silently fall back. Use the painted tier.`,
    );
  }
  // Paths emit in source order, which is z-order.
  const body = glyph.paths.map(renderPath).join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"` +
    ` viewBox="0 0 ${glyph.box} ${glyph.box}">${body}</svg>`;
  const hx = Math.round((glyph.hotspot[0] / glyph.box) * size);
  const hy = Math.round((glyph.hotspot[1] / glyph.box) * size);
  const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return `url("${uri}") ${hx} ${hy}, ${opts.fallback ?? 'default'}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/cursor/src/bake.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/cursor/src/bake.ts packages/cursor/src/bake.test.ts
git commit -m "bake a glyph into a CSS url() cursor with a scaled hotspot"
```

---

### Task 4: Author the glyph geometry and generate `glyphs.ts`

**Files:**
- Create: `packages/cursor/scripts/glyphs/draw.mjs`
- Create: `packages/cursor/scripts/gen-cursors.mjs`
- Create: `packages/cursor/src/glyphs.ts` (generated)
- Test: `packages/cursor/src/glyphs.test.ts`
- Modify: `package.json` (root, add `gen:cursors`)

Reference silhouettes come from the existing tool icons — `packages/core/src/icons/PencilIcon.tsx`, `PenIcon.tsx`, `EyedropperIcon.tsx` — re-drawn as **filled** shapes. Do not import from them: those are `fill: none` outlines centered for 16px chrome, and a cursor is a filled silhouette composed toward its hotspot.

- [ ] **Step 1: Write the failing test**

`packages/cursor/src/glyphs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GLYPHS } from './glyphs';
import { haloFitsInBox } from './types';

const NAMES = ['pencil', 'pen', 'bucket', 'eyedropper'] as const;

describe('GLYPHS', () => {
  it('ships the arc 1 set', () => {
    expect(Object.keys(GLYPHS).sort()).toEqual([...NAMES].sort());
  });

  it.each(NAMES)('%s keeps its halo inside the viewBox', (name) => {
    expect(haloFitsInBox(GLYPHS[name])).toBe(true);
  });

  it.each(NAMES)('%s puts its hotspot on the glyph, not at the origin', (name) => {
    // A forgotten hotspot defaults to (0,0) and the cursor points a full glyph
    // away from where it acts — the failure is obvious in use and invisible here
    // unless asserted.
    const [x, y] = GLYPHS[name].hotspot;
    expect(x + y).toBeGreaterThan(0);
    expect(x).toBeLessThanOrEqual(GLYPHS[name].box);
    expect(y).toBeLessThanOrEqual(GLYPHS[name].box);
  });

  it.each(NAMES)('%s has at least one ink path', (name) => {
    expect(GLYPHS[name].paths.some((p) => p.role === 'ink')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/cursor/src/glyphs.test.ts`
Expected: FAIL — `Failed to resolve import "./glyphs"`.

- [ ] **Step 3: Author the glyph geometry**

`packages/cursor/scripts/glyphs/draw.mjs`. The pencil is given resolved; it is the register proof's validated shape, offset by 2 units so the halo clears the viewBox.

```js
// Cursor glyphs: filled silhouettes on a 24-unit box, composed so the hotspot
// falls on the point the tool acts at. Distinct from the toolbar icon sets,
// which are `fill: none` outlines centred in their box.
//
// Geometry is computed, not eyeballed — see CLAUDE.md ("Drawing icons").

const n = (v) => Math.round(v * 100) / 100;

/** Point on a circle at math-angle `deg` (SVG y-down). */
const onCircle = (cx, cy, r, deg) => [
  n(cx + r * Math.cos((deg * Math.PI) / 180)),
  n(cy - r * Math.sin((deg * Math.PI) / 180)),
];

// ── pencil ───────────────────────────────────────────────────────────────
// The register-proof shape, translated +2 on both axes so 1.3 units of halo
// clear the box. Tip at (5,19) is the hotspot.
const pencil = {
  box: 24,
  hotspot: [5, 19],
  paths: [
    { role: 'ink', d: 'M 5 19 L 7.5 16.5 L 16 8 L 19 11 L 10.5 19.5 L 8 19 Z' },
    { role: 'detail', d: 'M 14 6 L 19 11', width: 1.2 },
  ],
};

// ── pen ──────────────────────────────────────────────────────────────────
// A nib: two edges meeting at the tip, with a slit up the centre. The slit is
// `detail` so it reads as a division rather than a second silhouette.
const pen = {
  box: 24,
  hotspot: [5, 19],
  paths: [
    { role: 'ink', d: 'M 5 19 L 8.5 9.5 L 13 5 L 18 10 L 13.5 14.5 Z' },
    { role: 'detail', d: 'M 7 15 L 12.5 9.5', width: 1.2 },
  ],
};

// ── bucket ───────────────────────────────────────────────────────────────
// Tilted pail with the spill leaving the lower-left lip; the hotspot is the
// spill point, not the pail's centre.
const bucketRim = onCircle(13.5, 9, 5.2, 150);
const bucket = {
  box: 24,
  hotspot: [5, 19],
  paths: [
    { role: 'ink', d: 'M 9.5 5.5 L 19 9 L 15.5 18 L 8 15.5 Z' },
    { role: 'ink', d: `M ${bucketRim[0]} ${bucketRim[1]} L 8.2 14 L 5 19 L 7.6 13.2 Z` },
    { role: 'detail', d: 'M 9.5 5.5 L 19 9', width: 1.2 },
  ],
};

// ── eyedropper ───────────────────────────────────────────────────────────
// Bulb upper-right, stem to a tip at lower-left. Tip is the hotspot.
const eyedropper = {
  box: 24,
  hotspot: [5, 19],
  paths: [
    { role: 'ink', d: 'M 5 19 L 6.5 14.5 L 15 6 L 18.5 9.5 L 10 18 Z' },
    { role: 'ink', d: 'M 15.5 4.5 L 19.5 8.5 L 17.5 10.5 L 13.5 6.5 Z' },
  ],
};

export const DRAW = { pencil, pen, bucket, eyedropper };
```

- [ ] **Step 4: Write the generator**

`packages/cursor/scripts/gen-cursors.mjs`:

```js
// Emits src/glyphs.ts from the definitions in ./glyphs/.
//
// The definitions compute their own geometry, so the checked-in glyphs.ts holds
// resolved literals and ships no math. Re-run after touching anything here:
//
//   npm run gen:cursors
//
// Proof a change before committing it: `node packages/cursor/scripts/proof-cursors.mjs`.

import { writeFileSync } from 'node:fs';
import { DRAW } from './glyphs/draw.mjs';

const out = `// GENERATED by scripts/gen-cursors.mjs — do not edit by hand.
// Filled silhouettes on a 24-unit box; the halo is applied at bake time.

import type { CursorGlyph } from './types';

export const GLYPHS = ${JSON.stringify(DRAW, null, 2)} as const satisfies Record<string, CursorGlyph>;

/** Every glyph name in the set. */
export type CursorGlyphName = keyof typeof GLYPHS;
`;

writeFileSync(new URL('../src/glyphs.ts', import.meta.url), out);
console.log(`wrote ${Object.keys(DRAW).length} glyphs to src/glyphs.ts`);
```

- [ ] **Step 5: Wire the script and generate**

Add to the root `package.json` scripts, next to `gen:icons`:

```json
"gen:cursors": "node packages/cursor/scripts/gen-cursors.mjs",
```

Run: `npm run gen:cursors`
Expected: `wrote 4 glyphs to src/glyphs.ts`

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/cursor/src/glyphs.test.ts`
Expected: PASS, 13 tests.

If a `haloFitsInBox` case fails, the glyph's coordinates run too close to an edge — pull them inward in `draw.mjs` and re-run `npm run gen:cursors`. Do not widen the box to dodge it; the box is the cursor's size budget.

- [ ] **Step 7: Commit**

```bash
git add packages/cursor/scripts packages/cursor/src/glyphs.ts \
        packages/cursor/src/glyphs.test.ts package.json
git commit -m "author four cursor glyphs and generate them to resolved literals"
```

---

### Task 5: Proof the glyphs and fix what the pixel grid shows

**Files:**
- Create: `packages/cursor/scripts/proof-cursors.mjs`
- Modify: `packages/cursor/scripts/glyphs/draw.mjs` (iterate on what the proof shows)

This task is a design gate, not a code gate. `CLAUDE.md` requires proofing a glyph at 10–15× *and* separately at true size on the pixel grid, because they disagree.

- [ ] **Step 1: Write the proof script**

`packages/cursor/scripts/proof-cursors.mjs`:

```js
// Headless proof sheet: every glyph over the three grounds a cursor actually
// crosses, large for geometry and again at true cursor size for legibility.
//
//   node packages/cursor/scripts/proof-cursors.mjs [outfile.png]
//
// Requires resvg on PATH (`brew install resvg`).

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { DRAW } from './glyphs/draw.mjs';

const INK = '#141418', HALO = '#ffffff', HW = 2.6;
const GROUNDS = [['white page', '#ffffff'], ['dark chrome', '#2a2a2e'], ['mid-tone art', '#6f7d8c']];
const MAG = 11;

const body = (g) =>
  g.paths
    .map((p) =>
      p.role === 'ink'
        ? `<path d="${p.d}" fill="${INK}" stroke="${HALO}" stroke-width="${HW}" stroke-linejoin="round" paint-order="stroke fill"/>`
        : p.role === 'detail'
          ? `<path d="${p.d}" fill="none" stroke="${HALO}" stroke-width="${p.width}" stroke-linecap="round"/>`
          : `<path d="${p.d}" fill="${p.fill}"/>`,
    )
    .join('');

const names = Object.keys(DRAW);
const CW = 24 * MAG + 150, CH = 24 * MAG + 40;
const W = 170 + GROUNDS.length * CW, H = 70 + names.length * CH;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#f4f4f2"/>
<style>.h{font:600 17px -apple-system,Helvetica,sans-serif;fill:#1b1b1f}
.g{font:500 13px -apple-system,Helvetica,sans-serif;fill:#555}</style>
<text x="16" y="30" class="h">Cursor glyph proof — ${MAG}x, plus true size at 24 and 16 px</text>`;
GROUNDS.forEach(([label], gi) =>
  (svg += `<text x="${170 + gi * CW}" y="56" class="g">${label}</text>`));
names.forEach((name, ni) => {
  const y0 = 62 + ni * CH;
  svg += `<text x="16" y="${y0 + 28}" class="g">${name}</text>`;
  GROUNDS.forEach(([, bg], gi) => {
    const x0 = 170 + gi * CW;
    svg += `<rect x="${x0}" y="${y0}" width="${CW - 16}" height="${CH - 16}" fill="${bg}"/>`;
    svg += `<g transform="translate(${x0 + 8},${y0 + 8}) scale(${MAG})">${body(DRAW[name])}</g>`;
    // True size, on the same ground: this is the check the large one cannot make.
    svg += `<g transform="translate(${x0 + 24 * MAG + 20},${y0 + 10}) scale(1)">${body(DRAW[name])}</g>`;
    svg += `<g transform="translate(${x0 + 24 * MAG + 20},${y0 + 44}) scale(${16 / 24})">${body(DRAW[name])}</g>`;
  });
});
svg += '</svg>';

const out = process.argv[2] ?? 'cursor-proof.png';
writeFileSync('/tmp/cursor-proof.svg', svg);
execFileSync('resvg', ['--zoom', '2', '/tmp/cursor-proof.svg', out]);
console.log('wrote', out);
```

- [ ] **Step 2: Render the proof**

Run: `node packages/cursor/scripts/proof-cursors.mjs /tmp/cursor-proof.png`
Expected: `wrote /tmp/cursor-proof.png`

- [ ] **Step 3: Put it on the wall and read it**

Run: `~/src/slopboard/bin/slop /tmp/cursor-proof.png`

Judge each glyph against three questions, and fix `draw.mjs` + re-run `npm run gen:cursors` for any failure:

1. **Is it identifiable at 24px?** A bucket that reads as a blob is a failed glyph however good it looks at 11×.
2. **Does the halo close all the way around the ink?** A gap means two shapes are touching without merging.
3. **Does a `detail` line survive at 16px, or does it close up?** If it closes, widen it or delete it — a detail that becomes a smudge is worse than no detail.

- [ ] **Step 4: Commit**

```bash
git add packages/cursor/scripts packages/cursor/src/glyphs.ts
git commit -m "proof the cursor glyphs headlessly and correct what small size showed"
```

---

### Task 6: The memoized registry and the barrel

**Files:**
- Create: `packages/cursor/src/registry.ts`
- Modify: `packages/cursor/src/index.ts`
- Test: `packages/cursor/src/registry.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/cursor/src/registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cursorFor } from './registry';

describe('cursorFor', () => {
  it('returns a bakeable cursor string for a known glyph', () => {
    expect(cursorFor('pencil')).toMatch(/^url\("data:image\/svg\+xml,/);
  });

  it('memoizes on name and options', () => {
    // The hover pump calls this on every idle pointermove; an unmemoized bake
    // would build a fresh data URI per pointer event.
    expect(cursorFor('pencil', { size: 24 })).toBe(cursorFor('pencil', { size: 24 }));
  });

  it('does not collide across sizes', () => {
    expect(cursorFor('pencil', { size: 24 })).not.toBe(cursorFor('pencil', { size: 32 }));
  });

  it('does not collide across fallbacks', () => {
    expect(cursorFor('pencil', { fallback: 'crosshair' })).not.toBe(
      cursorFor('pencil', { fallback: 'default' }),
    );
  });

  it('throws on an unknown glyph name rather than yielding an empty cursor', () => {
    // @ts-expect-error — exercising the runtime guard behind the type.
    expect(() => cursorFor('trowel')).toThrow(/trowel/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/cursor/src/registry.test.ts`
Expected: FAIL — `Failed to resolve import "./registry"`.

- [ ] **Step 3: Write the implementation**

`packages/cursor/src/registry.ts`:

```ts
import { bakeCursor } from './bake';
import type { BakeOptions } from './bake';
import { GLYPHS } from './glyphs';
import type { CursorGlyphName } from './glyphs';
import type { CursorGlyph } from './types';

const cache = new Map<string, string>();

/**
 * The baked cursor string for a named glyph, memoized.
 *
 * The key space is bounded by the glyph set times the handful of sizes and
 * fallbacks in use, so the cache needs no eviction.
 */
export function cursorFor(name: CursorGlyphName, opts: BakeOptions = {}): string {
  const size = opts.size ?? 24;
  const fallback = opts.fallback ?? 'default';
  const key = `${name}|${size}|${fallback}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  // Widened deliberately: the key type says this is always defined, but the
  // guard is what makes a bad name from untyped JS throw instead of baking
  // `undefined` into a cursor string that silently does nothing.
  const glyph = (GLYPHS as Record<string, CursorGlyph | undefined>)[name];
  if (glyph === undefined) {
    throw new Error(`unknown cursor glyph: ${String(name)}`);
  }
  const css = bakeCursor(glyph, { size, fallback });
  cache.set(key, css);
  return css;
}
```

- [ ] **Step 4: Write the barrel**

`packages/cursor/src/index.ts`:

```ts
export { bakeCursor } from './bake';
export type { BakeOptions } from './bake';
export { cursorFor } from './registry';
export { GLYPHS } from './glyphs';
export type { CursorGlyphName } from './glyphs';
export {
  CURSOR_HALO,
  CURSOR_HALO_WIDTH,
  CURSOR_INK,
  CURSOR_MAX_CSS_PX,
  haloFitsInBox,
} from './types';
export type { CursorGlyph, CursorPath } from './types';
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run --project=weasel-ui packages/cursor`
Expected: PASS, 28 tests across four files.

Run: `npx tsc --noEmit`
Expected: exits 0. Run this from the repo root — `tsc -p packages/*/tsconfig.json` reports pre-existing `TS6059` errors that are not yours.

- [ ] **Step 6: Commit**

```bash
git add packages/cursor/src/registry.ts packages/cursor/src/registry.test.ts \
        packages/cursor/src/index.ts
git commit -m "memoize baked cursors behind a named-glyph registry"
```

---

### Task 7: Put the cursors on the tools

**Files:**
- Modify: `packages/core/package.json` (add the dependency)
- Modify: `packages/core/src/tools/builtin/pencil/usePencilTool.tsx:46`
- Modify: `packages/core/src/tools/builtin/pen/usePenTool.ts:455`
- Modify: `packages/core/src/tools/builtin/eyedropper/useEyedropperTool.ts:92`
- Test: `packages/core/src/tools/builtin/cursors.test.ts`

There is no bucket tool yet; the `bucket` glyph ships unused and gets its consumer when a fill tool lands. `Tool.cursor` already accepts any string, so no core types change in this arc.

- [ ] **Step 1: Declare the dependency**

In `packages/core/package.json`, add to `dependencies`:

```json
"@weasel-js/cursor": "1.3.0",
```

An undeclared dependency resolves fine in the workspace and in the consumer smoke test — only `npm run check:manifests` catches it. Then run `npm install`.

- [ ] **Step 2: Write the failing test**

`packages/core/src/tools/builtin/cursors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cursorFor } from '@weasel-js/cursor';

/**
 * jsdom has no cursor, so nothing here can prove anything rendered. These
 * assert the string the tool hands the host, which is the last thing on this
 * side of the boundary that is ours to get right.
 */
describe('builtin tool cursors', () => {
  it('gives the pencil tool a pencil, falling back to crosshair', () => {
    const css = cursorFor('pencil', { fallback: 'crosshair' });
    expect(css).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(css).toMatch(/, crosshair$/);
  });

  it('keeps the pen tool on a keyword while it hints a close', () => {
    // usePenTool swaps to 'pointer' when closing the subpath is the next click;
    // that hint is about routing, not about the tool, so it stays a keyword.
    expect(cursorFor('pen', { fallback: 'crosshair' })).not.toBe('pointer');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/tools/builtin/cursors.test.ts`
Expected: FAIL — cannot resolve `@weasel-js/cursor` until step 1's install completes; if it resolves, the test passes trivially and you should confirm the import is real before moving on.

Note this suite runs under the **`kit`** project, not `weasel-ui` — core is excluded from the `weasel-ui` glob.

- [ ] **Step 4: Swap the tool cursors**

In `usePencilTool.tsx`, replace `cursor: 'crosshair',` with:

```tsx
cursor: cursorFor('pencil', { fallback: 'crosshair' }),
```

and add `import { cursorFor } from '@weasel-js/cursor';` at the top.

In `usePenTool.ts`, the cursor is already a function; keep its close-hint branch and swap only the resting arm:

```ts
cursor: () =>
  scratchRef.current?.closeHintActive
    ? 'pointer'
    : cursorFor('pen', { fallback: 'crosshair' }),
```

In `useEyedropperTool.ts`, replace `cursor: 'crosshair',` with:

```ts
cursor: cursorFor('eyedropper', { fallback: 'crosshair' }),
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run --project=kit packages/core/src/tools`
Expected: PASS. Any existing test asserting `cursor === 'crosshair'` on these three tools now fails correctly — update it to assert the `url("data:` prefix, and say in the test that jsdom cannot check rendering.

- [ ] **Step 6: Verify the whole suite and the manifests**

Run: `npx vitest run --project=kit --project=weasel-ui`
Expected: PASS.

Run: `npm run build -w @weasel-js/cursor && npm run check:manifests`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add packages/core packages/cursor package-lock.json
git commit -m "give pencil, pen and eyedropper real cursors"
```

---

### Task 8: Land the browser probe harness

**Files:**
- Create: `packages/cursor/scripts/probe/warp.swift`
- Create: `packages/cursor/scripts/probe/probe.mjs`
- Create: `packages/cursor/scripts/probe/README.md`

The spec names measuring Safari and Firefox as worthwhile, and this harness is the only thing that can do it — a headless browser draws no cursor at all. It is a script, so it re-derives its claim by running; that is why it is worth keeping when a paragraph asserting the same numbers would not be.

- [ ] **Step 1: Write `warp.swift`**

`CGWarpMouseCursorPosition` moves the OS pointer without needing accessibility
permission, which posting a synthetic event would.

```swift
import CoreGraphics
import Foundation

let a = CommandLine.arguments
guard a.count == 3, let x = Double(a[1]), let y = Double(a[2]) else { exit(2) }
CGWarpMouseCursorPosition(CGPoint(x: x, y: y))
CGAssociateMouseAndMouseCursorPosition(1)
```

- [ ] **Step 2: Write `probe.mjs`**

The two subtleties: the pointer must be warped **twice** so Chrome sees a move
and re-evaluates the cursor, and page coordinates convert to screen points
through `outerHeight - innerHeight`, which is the browser chrome above the
viewport.

```js
// Drives headful Chrome over a page of cursor declarations, warping the OS
// pointer into it and capturing the screen WITH the cursor (-C). A headless
// browser draws no cursor, so this is the only way to see what was rasterized.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const DIR = process.argv[2] ?? '.';
mkdirSync(`${DIR}/shots`, { recursive: true });
const warp = (x, y) => execFileSync(`${DIR}/warp`, [String(x), String(y)]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: false,
  channel: 'chrome',
  args: ['--window-position=60,60', '--window-size=900,700'],
});
const page = await browser.newPage({ viewport: null });
await page.goto(`file://${DIR}/cursor-probe.html`);
await sleep(700);
execFileSync('osascript', ['-e', 'tell application "Google Chrome" to activate']);
await sleep(600);

const g = await page.evaluate(() => window.__geom());
const ids = await page.evaluate(() => window.__cases);
const ox = g.screenX;
const oy = g.screenY + (g.outerH - g.innerH);

for (let i = 0; i < ids.length; i++) {
  const r = await page.evaluate((n) => window.__setCase(n), i);
  await sleep(120);
  warp(ox + 294, oy + 294);
  await sleep(90);
  warp(ox + 300, oy + 300);
  await sleep(260);
  execFileSync('screencapture', [
    '-x', '-C', '-R', `${ox + 270},${oy + 270},150,150`,
    `${DIR}/shots/${String(i).padStart(2, '0')}-${r.id}.png`,
  ]);
  console.log(`${i + 1}/${ids.length}  ${r.id}`);
}
await browser.close();
```

The companion `cursor-probe.html` supplies `__geom()`, `__cases` and
`__setCase(i)`; build it however the question at hand needs — one full-viewport
div whose `style.cursor` each case sets. Compare captures by hash: a declaration
the browser rejected produces a capture byte-identical to the fallback keyword's,
which is how the 128px cap was found.

- [ ] **Step 3: Write the README**

`packages/cursor/scripts/probe/README.md`:

```markdown
# Cursor probe

Answers "what did the compositor actually draw?" for a cursor declaration.
A headless browser has no cursor, so this needs a real window: it launches
headful Chrome, warps the OS pointer over the page, and captures the screen
with `screencapture -C`, which includes the cursor.

    swiftc -O -o warp warp.swift      # once
    node probe.mjs <outdir>

macOS only, and it steals focus for the duration. The findings it produced
are recorded in the spec's "Measured browser behavior"; re-run it only to
extend them to another engine.
```

- [ ] **Step 4: Verify it compiles**

Run: `swiftc -O -o packages/cursor/scripts/probe/warp packages/cursor/scripts/probe/warp.swift`
Expected: compiles clean.

Do not run the probe as part of any test or CI target. It is a manual instrument.

- [ ] **Step 5: Keep the compiled binary out of git**

Add to `.gitignore`:

```
packages/cursor/scripts/probe/warp
```

- [ ] **Step 6: Commit**

```bash
git add packages/cursor/scripts/probe .gitignore
git commit -m "keep the cursor probe harness that measured the browser facts"
```

---

### Task 9: Changeset and README

**Files:**
- Create: `.changeset/cursor-arc-1-baked-tier.md`
- Create: `packages/cursor/README.md`

- [ ] **Step 1: Write the changeset**

**`patch`, always.** Every changeset in this repo is `patch` regardless of what it adds; `minor` and `major` are Mike's explicit calls and `npm run check:bumps` enforces it. Do not write a `bump-approved` marker.

`.changeset/cursor-arc-1-baked-tier.md`:

```markdown
---
'@weasel-js/cursor': patch
'@weasel-js/core': patch
---

Add `@weasel-js/cursor` and give three tools real cursors.

A cursor glyph is SVG path `d` strings tagged with a paint role plus a hotspot
in glyph units; `bakeCursor` renders one to a `url(data:image/svg+xml,…)`
string with the hotspot scaled to integer CSS px, and `cursorFor` memoizes that
per name and size. The pencil, pen and eyedropper tools now show their own
glyph instead of a shared `crosshair`.

Cursors ship as SVG with no bitmap fallback: Chrome rasterizes an SVG data-URI
cursor at device scale, so it is already crisp on a retina display. `bakeCursor`
throws above 128 CSS px rather than emitting a cursor the browser would drop
silently — that size is where the painted tier will take over.

New API: `bakeCursor`, `cursorFor`, `GLYPHS`, `haloFitsInBox`, `CursorGlyph`,
`CursorPath`, `CursorGlyphName`, `BakeOptions`, and the register constants.
```

- [ ] **Step 2: Write the README**

`packages/cursor/README.md`:

```markdown
# @weasel-js/cursor

Tool cursors as authored glyphs.

```ts
import { cursorFor } from '@weasel-js/cursor';

const tool = defineTool({
  id: 'pencil',
  cursor: cursorFor('pencil', { fallback: 'crosshair' }),
});
```

A glyph is a set of SVG path `d` strings with paint roles and a hotspot in
glyph units. `cursorFor` bakes one into a CSS cursor value and memoizes it.

Always pass a `fallback`: if the browser rejects the image the element falls
back to that keyword, and with none declared it lands on `auto`.

Glyph geometry is authored in `scripts/glyphs/` and generated to resolved
literals with `npm run gen:cursors`. Proof a change before committing it —
`node scripts/proof-cursors.mjs` renders every glyph over three grounds at
proof size and at true size.
```

- [ ] **Step 3: Verify the bump check**

Run: `npm run check:bumps`
Expected: exits 0.

- [ ] **Step 4: Full verification before handing back**

Run: `npx tsc --noEmit && npx vitest run --project=kit --project=weasel-ui && npm run check:manifests && npm run check:bumps`
Expected: all four exit 0. Read the pass counts in the output; do not infer success from an exit code alone, and do not background this run.

- [ ] **Step 5: Commit**

```bash
git add .changeset packages/cursor/README.md
git commit -m "add the cursor package changeset and README"
```

---

## Done when

- `npx vitest run --project=weasel-ui packages/cursor` passes.
- The pencil, pen and eyedropper tools show their own cursor in `npm run dev:kit`, and it stays legible over the white page, the workspace and dark artwork.
- `npm run check:manifests` and `npm run check:bumps` both exit 0.
- A proof sheet has been rendered and looked at, at true size as well as large.
