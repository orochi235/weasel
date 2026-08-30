# Stroke Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SVG-style stroke markers (arrowheads and other line terminators) to `@weasel-js/core` as stroke style, including the stroke inset that keeps a filled head from being speared, and `<marker>` round-trip in `@weasel-js/svg`.

**Architecture:** Three new fields on `Stroke` hold string keys. A module-global string-keyed registry (modeled on `registerPaintKind`) maps a key to geometry, paints, an inset and an orientation rule. The inset trims the flattened polyline before dashing, inside the tessellator. Markers themselves render as separate `PathDrawCommand`s emitted by the node painter, not as triangles in the stroke ribbon.

**Tech Stack:** TypeScript, vitest, WebGL2 (no Canvas2D renderer exists), Playwright for visual baselines.

**Design spec:** `docs/superpowers/specs/2026-08-30-stroke-markers-design.md`

**Worktree:** `/Users/mike/src/weasel/.claude/worktrees/stroke-markers`, branch `feat/stroke-markers`. All paths below are relative to that worktree root.

**Test commands:**
- `packages/core/**` → `npx vitest run --project=kit <path>`
- `packages/paint/**`, `packages/svg/**` → `npx vitest run --project=weasel-ui <path>`
- Typecheck → `npx tsc --noEmit` from the repo root (never `tsc -p packages/core/tsconfig.json`, which emits 31 pre-existing TS6059 errors)

---

## File Structure

**Create:**
- `packages/core/src/core/strokeMarkers.ts` — the registry. Sits beside `core/paintKinds.ts`, the registry it is modeled on.
- `packages/core/src/core/markerInset.ts` — resolves a `MarkerRef` to a distance. The one place a key becomes a number.
- `packages/core/src/features/paths/strokeMarkerShapes.ts` — built-in geometry. Sits beside the other path builders.
- `packages/core/src/features/paths/tessellate/trim.ts` — `trimPolyline`, the inset pass.
- `packages/core/src/features/paths/markerSites.ts` — where markers go and which way they point.
- `packages/core/src/features/paths/markerCommands.ts` — sites plus entries into draw commands.
- `apps/site/demos/StrokeMarkersDemo.tsx` — demo, required for the visual baseline.
- `tests/visual/stroke-markers.spec.ts` — visual baseline spec.

**Layering rule, and it is load-bearing.** `features/paths/tessellate/` imports nothing from
`core/` today but the `Path` type — no React, no scene, no GL. Keep it that way: the tessellator
takes insets as **numbers** through `StrokeOptions`, and `strokeMeshCache` resolves the key
against the registry before calling it. That thinness is the whole reason this layer could later
become its own package (the only real blocker being that `Path` is declared in core while its
`PATH_*` opcodes already live in `@weasel-js/geom`). Task 5 ends with a grep that checks the
dependency did not leak.

**Deliberately unchanged:** `outlineStrokeMeshCache.ts:70` and `layoutRuns.ts:296`
(`strokeKey`) both enumerate stroke fields, and both are correct to leave alone. Glyph outlines
are closed subpaths, and `trimPolyline` is a no-op on a closed subpath; markers are not painted
for text runs at all. Adding the fields to those keys would only fragment two caches for
strokes that can never differ.

**Modify:**
- `packages/paint/src/paint.ts` — `MarkerKey`, `MarkerRef`, three `Stroke` fields.
- `packages/paint/src/index.ts` — export them.
- `packages/core/src/features/paths/tessellate/stroke.ts:102-107` — call the trim.
- `packages/core/src/renderer/cache/strokeMeshCache.ts:36-46` — `configKey` gains the inset.
- `packages/core/src/canvas/NodeShape.ts` — emit marker commands; `inkReach` grows.
- `packages/core/src/index.ts` — barrel.
- `packages/svg/src/{types,cascade,parse,serialize,unpack,gradients}.ts` — round-trip.
- `apps/site/registry.ts` — register the demo.

**Do not touch** `packages/core/src/features/paths/markers.ts`. It already exists, is unrelated (`circlePath`/`squarePath` for selection chrome), and its header scopes it to transient decorative geometry.

---

## Task 1: Marker fields on `Stroke`

Types only, no behavior. Everything downstream depends on these names.

**Files:**
- Modify: `packages/paint/src/paint.ts` (after the `Stroke` interface, ~line 178)
- Modify: `packages/paint/src/index.ts`
- Test: `packages/paint/src/markers.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/paint/src/markers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Stroke, MarkerRef } from './paint';

describe('marker fields on Stroke', () => {
  it('accepts a bare key and survives a JSON round-trip', () => {
    const stroke: Stroke = {
      paint: { fill: 'solid', color: '#000' },
      width: 2,
      markerEnd: 'arrow',
    };
    expect(JSON.parse(JSON.stringify(stroke))).toEqual(stroke);
  });

  it('accepts a sized reference in both unit systems', () => {
    const scaled: MarkerRef = { key: 'arrow', size: 3 };
    const pinned: MarkerRef = { key: 'arrow', size: { px: 12 } };
    expect(scaled).toEqual({ key: 'arrow', size: 3 });
    expect(pinned).toEqual({ key: 'arrow', size: { px: 12 } });
  });

  it('accepts all three positions and a consumer key', () => {
    const stroke: Stroke = {
      paint: { fill: 'solid', color: '#000' },
      markerStart: 'circle',
      markerMid: { key: 'app:tick' },
      markerEnd: 'arrow',
    };
    expect(stroke.markerMid).toEqual({ key: 'app:tick' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/paint/src/markers.test.ts`
Expected: FAIL — TypeScript errors, `'markerEnd' does not exist in type 'Stroke'`.

- [ ] **Step 3: Add the types**

In `packages/paint/src/paint.ts`, immediately before `export interface Stroke {`:

```ts
/**
 * The kit's built-in marker vocabulary, open on the string the way
 * `PaintKind` is so a consumer's registered key typechecks.
 */
export type KitMarkerKey =
  | 'arrow' | 'arrow-open' | 'arrow-concave'
  | 'diamond' | 'diamond-hollow'
  | 'circle' | 'square' | 'bar';
export type MarkerKey = KitMarkerKey | (string & {});

/**
 * A marker on one end (or every interior vertex) of a stroke.
 *
 * `size` reuses `Stroke.width`'s unit system: a bare number scales with the
 * resolved stroke width, `{ px }` pins screen pixels. That is SVG's
 * `markerUnits` in the idiom this codebase already resolves at draw time.
 * Omitted, the marker is one stroke width per unit.
 */
export type MarkerRef = MarkerKey | { key: MarkerKey; size?: number | { px: number } };
```

Then inside `Stroke`, after the `dash` field:

```ts
  /** Marker at the first vertex of each open subpath, rotated to point back
   *  along the line (SVG's `auto-start-reverse`, as the only behavior). */
  markerStart?: MarkerRef;
  /** Marker at every interior authored vertex, on the bisector of the
   *  incoming and outgoing directions. Never insets the stroke. */
  markerMid?: MarkerRef;
  /** Marker at the last vertex of each open subpath. */
  markerEnd?: MarkerRef;
```

In `packages/paint/src/index.ts`, add to the existing `export type { ... }` block: `KitMarkerKey`, `MarkerKey`, `MarkerRef`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/paint/src/markers.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/paint/src/paint.ts packages/paint/src/index.ts packages/paint/src/markers.test.ts
git commit -m "add marker fields to Stroke"
```

---

## Task 2: The marker registry

**Files:**
- Create: `packages/core/src/core/strokeMarkers.ts`
- Test: `packages/core/src/core/strokeMarkers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/core/strokeMarkers.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import {
  registerMarker, getMarker, listMarkers, _resetMarkersForTests,
  type MarkerEntry,
} from './strokeMarkers';
import { PATH_M, PATH_L, PATH_Z } from './geometry/path';

afterEach(() => { _resetMarkersForTests(); });

const TRIANGLE: MarkerEntry = {
  id: 'app:tri',
  path: () => ({
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
    coords: new Float32Array([0, 0, -3, -1.5, -3, 1.5]),
    fillRule: 'nonzero',
  }),
  inset: 3,
};

describe('marker registry', () => {
  it('resolves a registered entry by key', () => {
    registerMarker(TRIANGLE);
    expect(getMarker('app:tri')).toBe(TRIANGLE);
  });

  it('answers undefined for an unknown key', () => {
    expect(getMarker('app:nope')).toBeUndefined();
  });

  it('removes the entry when disposed', () => {
    const dispose = registerMarker(TRIANGLE);
    dispose();
    expect(getMarker('app:tri')).toBeUndefined();
  });

  it('restores the built-in when an override is disposed', () => {
    const builtin = getMarker('arrow');
    expect(builtin).toBeDefined();
    const dispose = registerMarker({ ...TRIANGLE, id: 'arrow' });
    expect(getMarker('arrow')).not.toBe(builtin);
    dispose();
    expect(getMarker('arrow')).toBe(builtin);
  });

  it('ignores a disposer whose entry was already replaced', () => {
    const first = registerMarker(TRIANGLE);
    registerMarker({ ...TRIANGLE, inset: 9 });
    first();
    expect(getMarker('app:tri')?.inset).toBe(9);
  });

  it('enumerates the built-in vocabulary', () => {
    const ids = listMarkers().map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining([
      'arrow', 'arrow-open', 'arrow-concave',
      'diamond', 'diamond-hollow', 'circle', 'square', 'bar',
    ]));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/core/strokeMarkers.test.ts`
Expected: FAIL — `Cannot find module './strokeMarkers'`.

- [ ] **Step 3: Write the registry**

Create `packages/core/src/core/strokeMarkers.ts`:

```ts
/**
 * The stroke-marker registry — arrowheads and other line terminators.
 *
 * Keyed by string, because a key is what sits in `stroke.markerEnd`. That is
 * the difference from `registerNodeShape`, which resolves by first-matching
 * predicate and whose `id` is only a label.
 *
 * A built-in's SVG slot lives in `@weasel-js/svg` and cannot be imported here
 * without inverting a package dependency, so an entry carries `toSvg` for that
 * package to consume — the same split `PaintKindEntry` uses.
 */

import type { FillStyle, MarkerKey, Stroke } from '@weasel-js/paint';
import type { Path } from './geometry/path';
import { bumpNodeMemoGeneration } from './scene/nodeMemo';
import { BUILTIN_MARKERS } from '../features/paths/strokeMarkerShapes';

/** What an entry's `path` is given. Entries that ignore it may return a
 *  constant path. */
export interface MarkerCtx {
  /** One geometry unit, in the same world units the ribbon is tessellated in.
   *  Defaults to the resolved stroke width. */
  readonly size: number;
  /** The stroke this marker belongs to, already width-resolved. */
  readonly stroke: Stroke;
}

/** `'line'` means the stroke's own paint — SVG 2's `context-stroke`, as the
 *  default rather than an opt-in. */
export type MarkerPaint = FillStyle | 'line' | 'none';

export interface MarkerEntry {
  /** `'kit:'`-free for built-ins so the key matches the SVG attribute value;
   *  consumers should prefix (`'app:my-head'`). */
  id: MarkerKey;
  /** Geometry with its anchor at the origin, pointing +X, in units of
   *  `ctx.size`. An arbitrary anchor is expressed by where the geometry is
   *  drawn, which is why there is no `refX`/`refY`. */
  path(ctx: MarkerCtx): Path;
  /** Default `'line'`. */
  fill?: MarkerPaint;
  /** Outline width is in the same units as `path`. `false` (the default)
   *  means no outline. */
  outline?: { width: number; paint?: MarkerPaint } | false;
  /** How far back along the line the stroke stops, in units of `ctx.size`.
   *  Default 0. A property of the shape, not a setting on the stroke: an open
   *  V needs 0 or its arms stop meeting the line. */
  inset?: number;
  /** `'auto'` (default) follows the line; a number is a fixed angle in
   *  radians, ignoring the line — SVG's `orient="<angle>"`. */
  orient?: 'auto' | number;
  /** Emits the `<marker>` def. Consumed by `@weasel-js/svg`. */
  toSvg?(id: string, entry: MarkerEntry): string;
}

let MARKERS = new Map<string, MarkerEntry>();

function seedBuiltins(): void {
  for (const entry of BUILTIN_MARKERS) MARKERS.set(entry.id, entry);
}
seedBuiltins();

/** Register a marker. Returns a disposer. Re-registering a built-in id is an
 *  override; disposing it restores the built-in rather than deleting the key. */
export function registerMarker(entry: MarkerEntry): () => void {
  const displaced = MARKERS.get(entry.id);
  MARKERS.set(entry.id, entry);
  // Marker geometry is read inside `NodeShape`'s per-node paint memo, so the
  // registered set is ambient state that memo cannot see change.
  bumpNodeMemoGeneration();
  return () => {
    if (MARKERS.get(entry.id) !== entry) return;
    if (displaced) MARKERS.set(entry.id, displaced);
    else MARKERS.delete(entry.id);
    bumpNodeMemoGeneration();
  };
}

/** The entry for `key`, or `undefined`. */
export function getMarker(key: string | undefined): MarkerEntry | undefined {
  return key === undefined ? undefined : MARKERS.get(key);
}

/** Every registered marker, built-ins first, in registration order. */
export function listMarkers(): readonly MarkerEntry[] {
  return [...MARKERS.values()];
}

/** Test helper. Do not call from product code. */
export function _resetMarkersForTests(): void {
  MARKERS = new Map();
  seedBuiltins();
  bumpNodeMemoGeneration();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/core/strokeMarkers.test.ts`
Expected: PASS, 6 tests. (Task 3 creates `strokeMarkerShapes`; if run before it, the import fails — do Task 3 first if you are executing out of order.)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/core/strokeMarkers.ts packages/core/src/core/strokeMarkers.test.ts
git commit -m "add a string-keyed stroke-marker registry"
```

---

## Task 3: Built-in marker geometry

Eight entries. Geometry is authored anchor-at-origin pointing +X, so the line arrives from −X.

**Files:**
- Create: `packages/core/src/features/paths/strokeMarkerShapes.ts`
- Test: `packages/core/src/features/paths/strokeMarkerShapes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/features/paths/strokeMarkerShapes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { BUILTIN_MARKERS } from './strokeMarkerShapes';
import type { PolygonPath } from '../../core/geometry/path';

const byId = (id: string) => {
  const e = BUILTIN_MARKERS.find((m) => m.id === id);
  if (!e) throw new Error(`no built-in marker ${id}`);
  return e;
};
const ctx = { size: 1, stroke: { paint: { fill: 'solid', color: '#000' } } } as const;

describe('built-in marker geometry', () => {
  it('ships the whole documented vocabulary', () => {
    expect(BUILTIN_MARKERS.map((m) => m.id)).toEqual([
      'arrow', 'arrow-open', 'arrow-concave',
      'diamond', 'diamond-hollow', 'circle', 'square', 'bar',
    ]);
  });

  it('anchors every entry at the origin', () => {
    for (const entry of BUILTIN_MARKERS) {
      const path = entry.path(ctx) as PolygonPath;
      const hits = [];
      for (let i = 0; i < path.coords.length; i += 2) {
        if (Math.hypot(path.coords[i], path.coords[i + 1]) < 1e-6) hits.push(i);
      }
      expect(hits.length, `${entry.id} has no vertex at the origin`).toBeGreaterThan(0);
    }
  });

  it('draws behind the anchor, never past it', () => {
    for (const entry of BUILTIN_MARKERS) {
      const path = entry.path(ctx) as PolygonPath;
      for (let i = 0; i < path.coords.length; i += 2) {
        expect(path.coords[i], `${entry.id} extends past the anchor`).toBeLessThanOrEqual(1e-6);
      }
    }
  });

  it('gives closed heads an inset and open heads none', () => {
    expect(byId('arrow').inset).toBe(3);
    expect(byId('arrow-concave').inset).toBe(3);
    expect(byId('diamond').inset).toBe(4);
    expect(byId('diamond-hollow').inset).toBe(4);
    expect(byId('circle').inset).toBe(2);
    expect(byId('square').inset).toBe(2);
    expect(byId('arrow-open').inset ?? 0).toBe(0);
    expect(byId('bar').inset ?? 0).toBe(0);
  });

  it('outlines the open and hollow heads, fills the rest', () => {
    expect(byId('arrow-open').fill).toBe('none');
    expect(byId('arrow-open').outline).toMatchObject({ width: 1 });
    expect(byId('bar').fill).toBe('none');
    expect(byId('diamond-hollow').fill).toBe('none');
    expect(byId('diamond-hollow').outline).toMatchObject({ width: 0.5 });
    expect(byId('arrow').fill ?? 'line').toBe('line');
  });

  it('scales geometry with ctx.size', () => {
    const small = byId('arrow').path({ ...ctx, size: 1 }) as PolygonPath;
    const large = byId('arrow').path({ ...ctx, size: 4 }) as PolygonPath;
    for (let i = 0; i < small.coords.length; i++) {
      expect(large.coords[i]).toBeCloseTo(small.coords[i] * 4, 5);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/features/paths/strokeMarkerShapes.test.ts`
Expected: FAIL — `Cannot find module './strokeMarkerShapes'`.

- [ ] **Step 3: Write the geometry**

Create `packages/core/src/features/paths/strokeMarkerShapes.ts`:

```ts
/**
 * The kit's built-in stroke-marker vocabulary.
 *
 * Every entry is authored with its anchor at the origin and pointing +X, so
 * the line arrives from −X and no geometry sits at positive X. Coordinates are
 * in units of `MarkerCtx.size`, which defaults to the resolved stroke width —
 * one definition is therefore correct at any line weight.
 *
 * Not to be confused with `./markers.ts`, which builds decorative chrome
 * shapes and is unrelated.
 */

import { PATH_M, PATH_L, PATH_Z, type PolygonPath } from '../../core/geometry/path';
import type { MarkerCtx, MarkerEntry } from '../../core/strokeMarkers';

function poly(pts: readonly number[], size: number, close = true): PolygonPath {
  const n = pts.length / 2;
  const commands = new Uint8Array(close ? n + 1 : n);
  commands[0] = PATH_M;
  for (let i = 1; i < n; i++) commands[i] = PATH_L;
  if (close) commands[n] = PATH_Z;
  const coords = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i++) coords[i] = pts[i] * size;
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

/** Circle of radius `r` centred at `cx`, in marker units. */
function circle(cx: number, r: number, size: number, segments = 32): PolygonPath {
  const pts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    pts.push(cx + r * Math.cos(theta), r * Math.sin(theta));
  }
  return poly(pts, size);
}

export const BUILTIN_MARKERS: readonly MarkerEntry[] = [
  {
    id: 'arrow',
    inset: 3,
    path: ({ size }: MarkerCtx) => poly([0, 0, -3, -1.5, -3, 1.5], size),
  },
  {
    id: 'arrow-open',
    inset: 0,
    fill: 'none',
    outline: { width: 1 },
    // Open at the back, so the ribbon runs to the vertex and the arms meet it.
    path: ({ size }: MarkerCtx) =>
      poly([-2.17, -1.25, 0, 0, -2.17, 1.25], size, false),
  },
  {
    id: 'arrow-concave',
    inset: 3,
    path: ({ size }: MarkerCtx) => poly([0, 0, -3, -1.5, -2, 0, -3, 1.5], size),
  },
  {
    id: 'diamond',
    inset: 4,
    path: ({ size }: MarkerCtx) => poly([0, 0, -2, -1.2, -4, 0, -2, 1.2], size),
  },
  {
    id: 'diamond-hollow',
    inset: 4,
    fill: 'none',
    outline: { width: 0.5 },
    path: ({ size }: MarkerCtx) => poly([0, 0, -2, -1.2, -4, 0, -2, 1.2], size),
  },
  {
    id: 'circle',
    inset: 2,
    path: ({ size }: MarkerCtx) => circle(-1, 1, size),
  },
  {
    id: 'square',
    inset: 2,
    path: ({ size }: MarkerCtx) => poly([0, -1, 0, 1, -2, 1, -2, -1], size),
  },
  {
    id: 'bar',
    inset: 0,
    fill: 'none',
    outline: { width: 1 },
    path: ({ size }: MarkerCtx) => poly([0, -1.5, 0, 1.5], size, false),
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/features/paths/strokeMarkerShapes.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/paths/strokeMarkerShapes.ts packages/core/src/features/paths/strokeMarkerShapes.test.ts
git commit -m "add the built-in stroke-marker vocabulary"
```

---

## Task 4: `trimPolyline`

The inset pass. Pure geometry, no rendering — test it hard here, because a bug shows up as a subtle gap much later.

**Files:**
- Create: `packages/core/src/features/paths/tessellate/trim.ts`
- Test: `packages/core/src/features/paths/tessellate/trim.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/features/paths/tessellate/trim.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { trimPolyline } from './trim';
import type { Polyline } from './polyline';

/** A straight run along +X from (0,0) to (10,0), sampled every 2 units. */
function straight(): Polyline {
  return {
    points: [0, 0, 2, 0, 4, 0, 6, 0, 8, 0, 10, 0],
    closed: false,
    anchorA: new Uint32Array([0, 0, 0, 0, 0, 0]),
    anchorB: new Uint32Array([1, 1, 1, 1, 1, 1]),
    anchorT: new Float32Array([0, 0.2, 0.4, 0.6, 0.8, 1]),
  };
}

describe('trimPolyline', () => {
  it('returns the polyline untouched when both insets are zero', () => {
    const pl = straight();
    expect(trimPolyline(pl, 0, 0)).toBe(pl);
  });

  it('moves the end point back by the end inset', () => {
    const out = trimPolyline(straight(), 0, 3)!;
    const n = out.points.length;
    expect(out.points[n - 2]).toBeCloseTo(7, 6);
    expect(out.points[n - 1]).toBeCloseTo(0, 6);
    expect(out.points[0]).toBeCloseTo(0, 6);
  });

  it('moves the start point forward by the start inset', () => {
    const out = trimPolyline(straight(), 2.5, 0)!;
    expect(out.points[0]).toBeCloseTo(2.5, 6);
    expect(out.points[1]).toBeCloseTo(0, 6);
  });

  it('trims both ends at once', () => {
    const out = trimPolyline(straight(), 1, 1)!;
    const n = out.points.length;
    expect(out.points[0]).toBeCloseTo(1, 6);
    expect(out.points[n - 2]).toBeCloseTo(9, 6);
  });

  it('drops the interior points the trim consumed', () => {
    const out = trimPolyline(straight(), 5, 0)!;
    // Original interior points at x = 6, 8; plus the cut at 5 and the end at 10.
    expect(Array.from(out.points).filter((_, i) => i % 2 === 0)).toEqual([5, 6, 8, 10]);
  });

  it('interpolates the anchor param at a cut inside one anchor span', () => {
    const out = trimPolyline(straight(), 3, 0)!;
    // x=3 is halfway between the samples at t=0.2 and t=0.4.
    expect(out.anchorT![0]).toBeCloseTo(0.3, 5);
    expect(out.anchorA![0]).toBe(0);
    expect(out.anchorB![0]).toBe(1);
  });

  it('returns null when the insets consume the whole run', () => {
    expect(trimPolyline(straight(), 6, 6)).toBeNull();
    expect(trimPolyline(straight(), 10, 0)).toBeNull();
  });

  it('leaves a closed subpath alone — it has no free ends', () => {
    const loop: Polyline = { ...straight(), closed: true };
    expect(trimPolyline(loop, 3, 3)).toBe(loop);
  });

  it('follows the actual arc length around a corner', () => {
    // (0,0) -> (4,0) -> (4,4): total length 8. Trim 6 from the start lands
    // 2 units up the vertical leg.
    const bent: Polyline = {
      points: [0, 0, 4, 0, 4, 4],
      closed: false,
      anchorA: new Uint32Array([0, 1, 1]),
      anchorB: new Uint32Array([1, 2, 2]),
      anchorT: new Float32Array([0, 0, 1]),
    };
    const out = trimPolyline(bent, 6, 0)!;
    expect(out.points[0]).toBeCloseTo(4, 6);
    expect(out.points[1]).toBeCloseTo(2, 6);
  });

  it('interpolates per-point widths at the cuts', () => {
    const pl: Polyline = { ...straight(), widths: new Float32Array([1, 2, 3, 4, 5, 6]) };
    const out = trimPolyline(pl, 3, 0)!;
    // x=3 sits halfway between the samples carrying width 2 and 3.
    expect(out.widths![0]).toBeCloseTo(2.5, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/features/paths/tessellate/trim.test.ts`
Expected: FAIL — `Cannot find module './trim'`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/features/paths/tessellate/trim.ts`:

```ts
/**
 * Shortening a flattened subpath so a filled marker is not speared by its own
 * line. SVG has no equivalent — it paints the marker over a full-length
 * stroke — so this is the one place our rendering deliberately differs.
 *
 * Runs before dash splitting, so a dash pattern fits the visible line rather
 * than running off under the head. The anchor-param interpolation matches
 * `splitForDash`'s rule for a boundary landing mid-segment.
 */

import type { Polyline } from './polyline';

const EPS = 1e-9;

interface Sample {
  x: number; y: number;
  a: number; b: number; t: number;
  w: number;
  /** Index of the first original point at or after this sample. */
  next: number;
}

function sampleAt(
  pl: Polyline, cum: Float64Array,
  A: Uint32Array, B: Uint32Array, T: Float32Array, W: Float32Array | undefined,
  dist: number,
): Sample {
  const n = cum.length;
  let i = 1;
  while (i < n - 1 && cum[i] < dist) i++;
  const segStart = cum[i - 1];
  const segLen = cum[i] - segStart;
  const f = segLen > EPS ? (dist - segStart) / segLen : 0;

  const px = pl.points[(i - 1) * 2], py = pl.points[(i - 1) * 2 + 1];
  const qx = pl.points[i * 2], qy = pl.points[i * 2 + 1];

  let a: number, b: number, t: number;
  if (A[i - 1] === A[i] && B[i - 1] === B[i]) {
    a = A[i - 1]; b = B[i - 1];
    t = T[i - 1] + (T[i] - T[i - 1]) * f;
  } else if (f < 0.5) {
    a = A[i - 1]; b = B[i - 1]; t = T[i - 1];
  } else {
    a = A[i]; b = B[i]; t = T[i];
  }

  const w = W ? W[i - 1] + (W[i] - W[i - 1]) * f : 0;
  return { x: px + (qx - px) * f, y: py + (qy - py) * f, a, b, t, w, next: i };
}

/**
 * Shorten `pl` by `startInset` from its first point and `endInset` from its
 * last, both in the same world units as the points.
 *
 * Returns `pl` itself when there is nothing to do (both insets zero, or the
 * subpath is closed and so has no free ends), and `null` when the insets
 * consume the whole run — a caller should then draw no ribbon at all.
 */
export function trimPolyline(
  pl: Polyline,
  startInset: number,
  endInset: number,
): Polyline | null {
  const from = Math.max(0, startInset);
  const to = Math.max(0, endInset);
  if (from <= 0 && to <= 0) return pl;
  if (pl.closed) return pl;

  const n = pl.points.length / 2;
  if (n < 2) return null;

  const A = pl.anchorA ?? new Uint32Array(n);
  const B = pl.anchorB ?? new Uint32Array(n);
  const T = pl.anchorT ?? new Float32Array(n);
  const W = pl.widths;

  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const dx = pl.points[i * 2] - pl.points[(i - 1) * 2];
    const dy = pl.points[i * 2 + 1] - pl.points[(i - 1) * 2 + 1];
    cum[i] = cum[i - 1] + Math.hypot(dx, dy);
  }
  const total = cum[n - 1];
  const cutA = from;
  const cutB = total - to;
  if (cutB - cutA <= EPS) return null;

  const head = sampleAt(pl, cum, A, B, T, W, cutA);
  const tail = sampleAt(pl, cum, A, B, T, W, cutB);

  const points: number[] = [head.x, head.y];
  const aOut: number[] = [head.a];
  const bOut: number[] = [head.b];
  const tOut: number[] = [head.t];
  const wOut: number[] | undefined = W ? [head.w] : undefined;

  for (let i = head.next; i < tail.next; i++) {
    points.push(pl.points[i * 2], pl.points[i * 2 + 1]);
    aOut.push(A[i]); bOut.push(B[i]); tOut.push(T[i]);
    if (wOut) wOut.push(W![i]);
  }

  points.push(tail.x, tail.y);
  aOut.push(tail.a); bOut.push(tail.b); tOut.push(tail.t);
  if (wOut) wOut.push(tail.w);

  return {
    points,
    closed: false,
    anchorA: new Uint32Array(aOut),
    anchorB: new Uint32Array(bOut),
    anchorT: new Float32Array(tOut),
    ...(wOut ? { widths: new Float32Array(wOut) } : {}),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/features/paths/tessellate/trim.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/paths/tessellate/trim.ts packages/core/src/features/paths/tessellate/trim.test.ts
git commit -m "add arc-length trimming for stroke marker insets"
```

---

## Task 5: Trim inside the tessellator, driven by explicit insets

The tessellation layer takes insets as **numbers**, never as a marker key. It imports nothing
from `core/` today but the `Path` type, and it must stay that way — that thinness is what would
let this layer become its own package later. Resolving a key against the registry happens one
level up, in Task 6.

**Files:**
- Modify: `packages/core/src/features/paths/tessellate/stroke.ts` — `StrokeOptions` (~line 8), the polyline loop (~lines 102-107)
- Test: `packages/core/src/features/paths/tessellate/strokeTrim.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/features/paths/tessellate/strokeTrim.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tessellateStroke } from './stroke';
import { PATH_M, PATH_L, type PolygonPath } from '../../../core/geometry/path';
import type { Stroke } from '@weasel-js/paint';

const LINE: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L]),
  coords: new Float32Array([0, 0, 100, 0]),
  fillRule: 'nonzero',
};
const BASE: Stroke = { paint: { fill: 'solid', color: '#000' }, width: 2 };

function spanX(mesh: { vertices: Float32Array }): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < mesh.vertices.length; i += 2) {
    lo = Math.min(lo, mesh.vertices[i]);
    hi = Math.max(hi, mesh.vertices[i]);
  }
  return [lo, hi];
}

describe('inset trimming in tessellateStroke', () => {
  it('reaches the full length with no insets', () => {
    expect(spanX(tessellateStroke(LINE, BASE))[1]).toBeCloseTo(100, 4);
  });

  it('stops short of the end by endInset', () => {
    expect(spanX(tessellateStroke(LINE, BASE, { endInset: 6 }))[1]).toBeCloseTo(94, 4);
  });

  it('starts late by startInset', () => {
    const [lo, hi] = spanX(tessellateStroke(LINE, BASE, { startInset: 6 }));
    expect(lo).toBeCloseTo(6, 4);
    expect(hi).toBeCloseTo(100, 4);
  });

  it('trims both ends at once', () => {
    const [lo, hi] = spanX(tessellateStroke(LINE, BASE, { startInset: 6, endInset: 6 }));
    expect(lo).toBeCloseTo(6, 4);
    expect(hi).toBeCloseTo(94, 4);
  });

  it('emits nothing when the insets swallow the line', () => {
    expect(tessellateStroke(LINE, BASE, { startInset: 60, endInset: 60 }).vertices.length).toBe(0);
  });

  it('trims each open subpath independently', () => {
    const two: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_M, PATH_L]),
      coords: new Float32Array([0, 0, 40, 0, 60, 0, 100, 0]),
      fillRule: 'nonzero',
    };
    const [lo, hi] = spanX(tessellateStroke(two, BASE, { startInset: 5, endInset: 5 }));
    expect(lo).toBeCloseTo(5, 4);
    expect(hi).toBeCloseTo(95, 4);
  });

  it('dashes the trimmed line, so the pattern fits what is visible', () => {
    const dashed = { ...BASE, dash: [10, 10] };
    const plain = tessellateStroke(LINE, dashed);
    const trimmed = tessellateStroke(LINE, dashed, { endInset: 30 });
    expect(spanX(trimmed)[1]).toBeLessThan(spanX(plain)[1]);
    expect(spanX(trimmed)[1]).toBeLessThanOrEqual(70 + 1e-4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/features/paths/tessellate/strokeTrim.test.ts`
Expected: FAIL — `endInset` is not a known option, so the ribbon still reaches 100.

- [ ] **Step 3: Extend `StrokeOptions` and the loop**

In `packages/core/src/features/paths/tessellate/stroke.ts`, add the import:

```ts
import { trimPolyline } from './trim';
```

Extend `StrokeOptions`:

```ts
/** Options for stroke tessellation. */
export interface StrokeOptions {
  flattenTolerance?: number;
  /**
   * Shorten each open subpath by this much at its start / end, in the same
   * world units as the path. Stroke markers use this so a filled head is not
   * speared by its own line; the caller resolves the distance, because this
   * layer knows nothing about the marker registry.
   */
  startInset?: number;
  endInset?: number;
}
```

Replace the polyline loop (currently `stroke.ts:102-107`):

```ts
  for (const pl of polylines) {
    const subs = dash.length > 0 ? splitForDash(pl, dash) : [pl];
    for (const sub of subs) {
      expandPolyline(sub, width, join, cap, miterLimit, varyingThreshold, verts, idx, anchorA, anchorB, anchorT);
    }
  }
```

with:

```ts
  // Trim before dashing, so the dash pattern fits the visible line rather than
  // running off under a marker head.
  const startInset = opts.startInset ?? 0;
  const endInset = opts.endInset ?? 0;
  for (const pl of polylines) {
    const trimmed = startInset > 0 || endInset > 0 ? trimPolyline(pl, startInset, endInset) : pl;
    if (trimmed === null) continue;
    const subs = dash.length > 0 ? splitForDash(trimmed, dash) : [trimmed];
    for (const sub of subs) {
      expandPolyline(sub, width, join, cap, miterLimit, varyingThreshold, verts, idx, anchorA, anchorB, anchorT);
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/features/paths/tessellate/strokeTrim.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Confirm the layer stayed clean**

Run: `grep -n "from '" packages/core/src/features/paths/tessellate/stroke.ts`
Expected: imports only `@weasel-js/core` (the `Path` type), `@weasel-js/paint`, `../../../renderer/cache/mesh`, `./polyline` and `./trim`. **No import from `core/`.** If one appeared, the inset resolution leaked down a layer — move it back up to Task 6.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/features/paths/tessellate/stroke.ts packages/core/src/features/paths/tessellate/strokeTrim.test.ts
git commit -m "let the stroke tessellator trim its ends by a caller-supplied inset"
```

---

## Task 6: Resolve insets from the registry, and key the cache on them

This is where a marker key becomes a number. Write the broken cache key first and watch it hand
back a stale ribbon — every test green, wrong pixels, which is the failure mode the repo's own
trap list warns about.

**Files:**
- Create: `packages/core/src/core/markerInset.ts`
- Modify: `packages/core/src/renderer/cache/strokeMeshCache.ts:36-46` (`configKey`) and the `tessellateStroke` call (~line 66)
- Test: `packages/core/src/core/markerInset.test.ts`, `packages/core/src/renderer/cache/strokeMeshCache.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/core/markerInset.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { markerInset, resolveMarkerSize, markerKeyOf, strokeInsets } from './markerInset';
import type { Stroke } from '@weasel-js/paint';

const BASE: Stroke = { paint: { fill: 'solid', color: '#000' }, width: 2 };

describe('marker inset resolution', () => {
  it('reads the key from either reference form', () => {
    expect(markerKeyOf('arrow')).toBe('arrow');
    expect(markerKeyOf({ key: 'arrow' })).toBe('arrow');
  });

  it('defaults one marker unit to the stroke width', () => {
    expect(resolveMarkerSize('arrow', 2)).toBe(2);
    expect(resolveMarkerSize({ key: 'arrow' }, 2)).toBe(2);
  });

  it('honours both size unit systems', () => {
    expect(resolveMarkerSize({ key: 'arrow', size: 5 }, 2)).toBe(5);
    expect(resolveMarkerSize({ key: 'arrow', size: { px: 12 } }, 2)).toBe(12);
  });

  it('multiplies the entry inset by the size', () => {
    expect(markerInset('arrow', 2)).toBeCloseTo(6, 6);
    expect(markerInset({ key: 'arrow', size: 5 }, 2)).toBeCloseTo(15, 6);
  });

  it('gives an open head no inset', () => {
    expect(markerInset('arrow-open', 2)).toBe(0);
    expect(markerInset('bar', 2)).toBe(0);
  });

  it('answers zero for an absent or unregistered marker', () => {
    expect(markerInset(undefined, 2)).toBe(0);
    expect(markerInset('app:nope', 2)).toBe(0);
  });

  it('never insets for a mid marker', () => {
    const insets = strokeInsets({ ...BASE, markerMid: 'arrow' }, 2);
    expect(insets).toEqual({ start: 0, end: 0 });
  });

  it('resolves start and end independently', () => {
    const insets = strokeInsets({ ...BASE, markerStart: 'circle', markerEnd: 'arrow' }, 2);
    expect(insets.start).toBeCloseTo(4, 6);
    expect(insets.end).toBeCloseTo(6, 6);
  });
});
```

Append to `packages/core/src/renderer/cache/strokeMeshCache.test.ts` (adding `PATH_M`, `PATH_L`, `PolygonPath` and `Stroke` to its imports if absent):

```ts
describe('marker inset in the cache key', () => {
  const path: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L]),
    coords: new Float32Array([0, 0, 100, 0]),
    fillRule: 'nonzero',
  };
  const base: Stroke = { paint: { fill: 'solid', color: '#000' }, width: 2 };
  const maxX = (m: { vertices: Float32Array }) => {
    let hi = -Infinity;
    for (let i = 0; i < m.vertices.length; i += 2) hi = Math.max(hi, m.vertices[i]);
    return hi;
  };

  it('misses the cache when only the marker inset changes', () => {
    const plain = strokeMesh(path, base, undefined);
    const marked = strokeMesh(path, { ...base, markerEnd: 'arrow' }, undefined);
    expect(marked).not.toBe(plain);
    expect(maxX(plain)).toBeCloseTo(100, 4);
    expect(maxX(marked)).toBeCloseTo(94, 4);
  });

  it('shares one entry between two markers with the same inset', () => {
    // 'arrow' and 'arrow-concave' both inset 3 — identical ribbons, so the
    // marker identity must not be part of the key.
    const a = strokeMesh(path, { ...base, markerEnd: 'arrow' }, undefined);
    const b = strokeMesh(path, { ...base, markerEnd: 'arrow-concave' }, undefined);
    expect(b).toBe(a);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project=kit packages/core/src/core/markerInset.test.ts packages/core/src/renderer/cache/strokeMeshCache.test.ts`
Expected: FAIL — `Cannot find module './markerInset'`, and the cache case returns an untrimmed ribbon reaching x=100.

- [ ] **Step 3: Write the resolver**

Create `packages/core/src/core/markerInset.ts`:

```ts
/**
 * Resolving a `MarkerRef` to the distance the ribbon must stop short.
 *
 * The tessellation layer takes these as plain numbers and knows nothing about
 * the registry — keeping that layer free of upward dependencies is deliberate.
 * The ribbon cache, the SVG serializer and `inkReach` all resolve through here,
 * so the ribbon, the export and the hit region cannot disagree about where the
 * line ends.
 */

import type { MarkerRef, Stroke } from '@weasel-js/paint';
import { getMarker } from './strokeMarkers';

/** The size of one marker unit, in the same world units as `strokeWidth`. */
export function resolveMarkerSize(ref: MarkerRef, strokeWidth: number): number {
  if (typeof ref === 'string' || ref.size === undefined) return strokeWidth;
  const { size } = ref;
  return typeof size === 'number' ? size : size.px;
}

export function markerKeyOf(ref: MarkerRef): string {
  return typeof ref === 'string' ? ref : ref.key;
}

/**
 * How far back the ribbon stops for `ref`, in world units. Zero for an absent
 * marker, an unregistered key, or an open head — never throws, because an
 * unknown key is a data problem and dropping the head is the graceful answer.
 */
export function markerInset(ref: MarkerRef | undefined, strokeWidth: number): number {
  if (ref === undefined) return 0;
  const entry = getMarker(markerKeyOf(ref));
  if (entry === undefined) return 0;
  return (entry.inset ?? 0) * resolveMarkerSize(ref, strokeWidth);
}

/** The start and end insets a stroke asks for. `markerMid` never insets —
 *  trimming at an interior vertex would cut the line in two. */
export function strokeInsets(stroke: Stroke, strokeWidth: number): { start: number; end: number } {
  return {
    start: markerInset(stroke.markerStart, strokeWidth),
    end: markerInset(stroke.markerEnd, strokeWidth),
  };
}
```

- [ ] **Step 4: Resolve and key in the cache**

In `packages/core/src/renderer/cache/strokeMeshCache.ts`, add:

```ts
import { strokeInsets } from '../../core/markerInset';
```

Replace `configKey`:

```ts
function configKey(stroke: Stroke, flattenTolerance: number | undefined): string {
  const width = resolveStrokeWidth(stroke.width ?? 1, 1);
  // Only the trim distance changes ribbon geometry. Marker *identity* belongs
  // to the draw commands the painter emits, not to these triangles — so two
  // heads with the same inset share one entry.
  const insets = strokeInsets(stroke, width);
  return [
    width,
    stroke.cap ?? 'butt',
    stroke.join ?? 'miter',
    stroke.miterLimit ?? '',
    stroke.align ?? 'center',
    (stroke.dash ?? []).join(','),
    stroke.varyingWidthJoinThreshold ?? '',
    flattenTolerance ?? '',
    insets.start,
    insets.end,
  ].join('|');
}
```

and pass them to the tessellator, replacing the `tessellateStroke` call in `strokeMesh`:

```ts
  const width = resolveStrokeWidth(stroke.width ?? 1, 1);
  const insets = strokeInsets(stroke, width);
  const mesh = tessellateStroke(path, stroke, {
    flattenTolerance,
    startInset: insets.start,
    endInset: insets.end,
  });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run --project=kit packages/core/src/core/markerInset.test.ts packages/core/src/renderer/cache/strokeMeshCache.test.ts`
Expected: PASS, including the pre-existing cache cases.

- [ ] **Step 6: Run the kit suite for regressions**

Run: `npx vitest run --project=kit`
Expected: PASS. Both insets are zero for every stroke without markers, so nothing existing should move.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/core/markerInset.ts packages/core/src/core/markerInset.test.ts packages/core/src/renderer/cache/strokeMeshCache.ts packages/core/src/renderer/cache/strokeMeshCache.test.ts
git commit -m "resolve marker insets in the ribbon cache and key on them"
```

---

## Task 7: Marker sites — position and angle

Where each marker goes and which way it points. Computed from the **untrimmed** polyline, since trimming moves the endpoint the marker anchors to.

**Files:**
- Create: `packages/core/src/features/paths/markerSites.ts`
- Test: `packages/core/src/features/paths/markerSites.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/features/paths/markerSites.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { markerSites } from './markerSites';
import type { Polyline } from './tessellate/polyline';

const ALL = { start: true, mid: true, end: true };

/** (0,0) -> (10,0), two authored anchors. */
function straight(): Polyline {
  return {
    points: [0, 0, 10, 0],
    closed: false,
    anchorA: new Uint32Array([0, 1]),
    anchorB: new Uint32Array([0, 1]),
    anchorT: new Float32Array([0, 0]),
  };
}

/** (0,0) -> (10,0) -> (10,10): one interior authored anchor at the corner. */
function bent(): Polyline {
  return {
    points: [0, 0, 10, 0, 10, 10],
    closed: false,
    anchorA: new Uint32Array([0, 1, 2]),
    anchorB: new Uint32Array([0, 1, 2]),
    anchorT: new Float32Array([0, 0, 0]),
  };
}

describe('markerSites', () => {
  it('puts the end marker on the last point, pointing along travel', () => {
    const end = markerSites(straight(), { start: false, mid: false, end: true });
    expect(end).toHaveLength(1);
    expect(end[0]).toMatchObject({ role: 'end', x: 10, y: 0 });
    expect(end[0].angle).toBeCloseTo(0, 6);
  });

  it('reverses the start marker so both heads point outward', () => {
    const start = markerSites(straight(), { start: true, mid: false, end: false });
    expect(start).toHaveLength(1);
    expect(start[0]).toMatchObject({ role: 'start', x: 0, y: 0 });
    expect(Math.abs(start[0].angle)).toBeCloseTo(Math.PI, 6);
  });

  it('places a mid marker on the bisector at an interior anchor', () => {
    const mid = markerSites(bent(), { start: false, mid: true, end: false });
    expect(mid).toHaveLength(1);
    expect(mid[0]).toMatchObject({ role: 'mid', x: 10, y: 0 });
    // Arriving +X, leaving +Y — the bisector is 45°.
    expect(mid[0].angle).toBeCloseTo(Math.PI / 4, 6);
  });

  it('emits no mid marker on a two-anchor run', () => {
    expect(markerSites(straight(), { start: false, mid: true, end: false })).toEqual([]);
  });

  it('skips flattened curve samples, keeping only authored anchors', () => {
    // Interior samples carry A !== B, marking them as curve interior.
    const curve: Polyline = {
      points: [0, 0, 3, 1, 6, 1, 10, 0],
      closed: false,
      anchorA: new Uint32Array([0, 0, 0, 1]),
      anchorB: new Uint32Array([0, 1, 1, 1]),
      anchorT: new Float32Array([0, 0.3, 0.7, 0]),
    };
    expect(markerSites(curve, { start: false, mid: true, end: false })).toEqual([]);
  });

  it('gives a closed subpath no start or end', () => {
    const loop: Polyline = { ...bent(), closed: true };
    const sites = markerSites(loop, ALL);
    expect(sites.some((s) => s.role === 'start' || s.role === 'end')).toBe(false);
  });

  it('returns nothing when no marker was asked for', () => {
    expect(markerSites(bent(), { start: false, mid: false, end: false })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/features/paths/markerSites.test.ts`
Expected: FAIL — `Cannot find module './markerSites'`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/features/paths/markerSites.ts`:

```ts
/**
 * Where a stroke's markers sit and which way they point.
 *
 * Computed from the *untrimmed* polyline: trimming moves the endpoint, and a
 * marker anchors to where the line was authored to end, not to where the
 * ribbon was cut.
 */

import type { Polyline } from './tessellate/polyline';

export interface MarkerSite {
  x: number;
  y: number;
  /** Radians. The direction the marker's +X axis should point — outward at a
   *  start or end, along the bisector at an interior vertex. */
  angle: number;
  role: 'start' | 'mid' | 'end';
}

export interface MarkerSiteRequest {
  start: boolean;
  mid: boolean;
  end: boolean;
}

const EPS = 1e-9;

/** Unit direction from point `i` to point `j`, or null if they coincide. */
function dir(pl: Polyline, i: number, j: number): { x: number; y: number } | null {
  const dx = pl.points[j * 2] - pl.points[i * 2];
  const dy = pl.points[j * 2 + 1] - pl.points[i * 2 + 1];
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;
  return { x: dx / len, y: dy / len };
}

/** The first index after `i` whose point differs from `i`'s. */
function nextDistinct(pl: Polyline, i: number, n: number): number {
  for (let k = i + 1; k < n; k++) if (dir(pl, i, k)) return k;
  return -1;
}
function prevDistinct(pl: Polyline, i: number): number {
  for (let k = i - 1; k >= 0; k--) if (dir(pl, k, i)) return k;
  return -1;
}

export function markerSites(pl: Polyline, want: MarkerSiteRequest): MarkerSite[] {
  const out: MarkerSite[] = [];
  const n = pl.points.length / 2;
  if (n < 2) return out;

  if (want.start && !pl.closed) {
    const j = nextDistinct(pl, 0, n);
    const d = j >= 0 ? dir(pl, 0, j) : null;
    if (d) {
      // Reversed, so a start head points away from the line body the way an
      // end head does. SVG spells this `auto-start-reverse`; here it is the
      // only behavior.
      out.push({ x: pl.points[0], y: pl.points[1], angle: Math.atan2(-d.y, -d.x), role: 'start' });
    }
  }

  if (want.mid) {
    const A = pl.anchorA, B = pl.anchorB, T = pl.anchorT;
    for (let i = 1; i < n - 1; i++) {
      // An authored anchor, not a flattened curve sample.
      if (!A || !B || !T) break;
      if (A[i] !== B[i] || T[i] !== 0) continue;
      const p = prevDistinct(pl, i);
      const q = nextDistinct(pl, i, n);
      if (p < 0 || q < 0) continue;
      const inDir = dir(pl, p, i)!;
      const outDir = dir(pl, i, q)!;
      let bx = inDir.x + outDir.x;
      let by = inDir.y + outDir.y;
      // A 180° reversal leaves no bisector; fall back to the arriving direction.
      if (Math.hypot(bx, by) < EPS) { bx = inDir.x; by = inDir.y; }
      out.push({ x: pl.points[i * 2], y: pl.points[i * 2 + 1], angle: Math.atan2(by, bx), role: 'mid' });
    }
  }

  if (want.end && !pl.closed) {
    const last = n - 1;
    const p = prevDistinct(pl, last);
    const d = p >= 0 ? dir(pl, p, last) : null;
    if (d) {
      out.push({ x: pl.points[last * 2], y: pl.points[last * 2 + 1], angle: Math.atan2(d.y, d.x), role: 'end' });
    }
  }

  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/features/paths/markerSites.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/paths/markerSites.ts packages/core/src/features/paths/markerSites.test.ts
git commit -m "compute stroke marker positions and orientations"
```

---

## Task 8: Build marker draw commands

Turn sites plus entries into `PathDrawCommand`s. Separate commands rather than triangles folded into the ribbon, so an entry can carry both a fill and an outline.

**Files:**
- Create: `packages/core/src/features/paths/markerCommands.ts`
- Test: `packages/core/src/features/paths/markerCommands.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/features/paths/markerCommands.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { markerDrawCommands } from './markerCommands';
import { registerMarker } from '../../core/strokeMarkers';
import { PATH_M, PATH_L, type PolygonPath } from '../../core/geometry/path';
import type { Stroke } from '@weasel-js/paint';

const LINE: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L]),
  coords: new Float32Array([0, 0, 100, 0]),
  fillRule: 'nonzero',
};
const PAINT = { fill: 'solid', color: '#f00' } as const;
const BASE: Stroke = { paint: PAINT, width: 2 };

describe('markerDrawCommands', () => {
  it('emits nothing for a stroke with no markers', () => {
    expect(markerDrawCommands(LINE, BASE, 2, undefined)).toEqual([]);
  });

  it('emits one filled command for a filled head', () => {
    const cmds = markerDrawCommands(LINE, { ...BASE, markerEnd: 'arrow' }, 2, undefined);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].fill).toEqual(PAINT);
    expect(cmds[0].stroke).toBeUndefined();
  });

  it('emits one outlined command for an open head', () => {
    const cmds = markerDrawCommands(LINE, { ...BASE, markerEnd: 'arrow-open' }, 2, undefined);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].fill).toBeUndefined();
    expect(cmds[0].stroke?.paint).toEqual(PAINT);
    // outline width 1 marker unit at size 2.
    expect(cmds[0].stroke?.width).toBeCloseTo(2, 6);
  });

  it('emits fill and outline together for a hollow head', () => {
    const cmds = markerDrawCommands(LINE, { ...BASE, markerEnd: 'diamond-hollow' }, 2, undefined);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].fill).toBeUndefined();
    expect(cmds[0].stroke).toBeDefined();
  });

  it('places the head at the line end, rotated to point along it', () => {
    const cmds = markerDrawCommands(LINE, { ...BASE, markerEnd: 'arrow' }, 2, undefined);
    const path = cmds[0].path as PolygonPath;
    // Anchor vertex lands on the line's end point.
    expect(path.coords[0]).toBeCloseTo(100, 4);
    expect(path.coords[1]).toBeCloseTo(0, 4);
    // Body trails back toward −X.
    expect(path.coords[2]).toBeLessThan(100);
  });

  it('emits a command per subpath end', () => {
    const two: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_M, PATH_L]),
      coords: new Float32Array([0, 0, 10, 0, 20, 0, 30, 0]),
      fillRule: 'nonzero',
    };
    const cmds = markerDrawCommands(two, { ...BASE, markerEnd: 'arrow' }, 2, undefined);
    expect(cmds).toHaveLength(2);
  });

  it('drops an unregistered key without throwing', () => {
    expect(markerDrawCommands(LINE, { ...BASE, markerEnd: 'app:nope' }, 2, undefined)).toEqual([]);
  });

  it('honours a fixed orient angle, ignoring the line direction', () => {
    // A vertical bar that must stay vertical whatever the line does.
    const dispose = registerMarker({
      id: 'app:fixed',
      orient: 0,
      path: ({ size }) => ({
        kind: 'polygon',
        commands: new Uint8Array([PATH_M, PATH_L]),
        coords: new Float32Array([0, -size, 0, size]),
        fillRule: 'nonzero',
      }),
      fill: 'none',
      outline: { width: 1 },
    });
    try {
      // A line running up-and-right; with orient 'auto' the bar would tilt.
      const diagonal: PolygonPath = {
        kind: 'polygon',
        commands: new Uint8Array([PATH_M, PATH_L]),
        coords: new Float32Array([0, 0, 50, 50]),
        fillRule: 'nonzero',
      };
      const cmds = markerDrawCommands(diagonal, { ...BASE, markerEnd: 'app:fixed' }, 2, undefined);
      const path = cmds[0].path as PolygonPath;
      // Both endpoints share an x — the bar did not rotate with the line.
      expect(path.coords[0]).toBeCloseTo(path.coords[2], 6);
    } finally {
      dispose();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/features/paths/markerCommands.test.ts`
Expected: FAIL — `Cannot find module './markerCommands'`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/features/paths/markerCommands.ts`:

```ts
/**
 * Turning a stroke's markers into draw commands.
 *
 * Separate `PathDrawCommand`s rather than triangles appended to the stroke
 * ribbon: an entry may carry a fill and an outline at once, or a paint that
 * differs from the line's, neither of which one mesh can express — and folding
 * them in would drag the whole marker vocabulary into the ribbon cache key.
 */

import type { MarkerRef, Stroke } from '@weasel-js/paint';
import type { Path, PolygonPath } from '../../core/geometry/path';
import type { PathDrawCommand } from '../../renderer/DrawCommand';
import { getMarker, type MarkerEntry, type MarkerPaint } from '../../core/strokeMarkers';
import { markerKeyOf, resolveMarkerSize } from '../../core/markerInset';
import { extractPolylines } from './tessellate/polyline';
import { markerSites, type MarkerSite } from './markerSites';

/** Rotate + translate a marker's geometry onto its site. */
function placed(path: Path, site: MarkerSite): PolygonPath {
  const src = path as PolygonPath;
  const cos = Math.cos(site.angle);
  const sin = Math.sin(site.angle);
  const coords = new Float32Array(src.coords.length);
  for (let i = 0; i < src.coords.length; i += 2) {
    const x = src.coords[i], y = src.coords[i + 1];
    coords[i] = site.x + x * cos - y * sin;
    coords[i + 1] = site.y + x * sin + y * cos;
  }
  return { kind: 'polygon', commands: src.commands, coords, fillRule: src.fillRule };
}

function resolvePaint(p: MarkerPaint | undefined, stroke: Stroke, fallback: MarkerPaint) {
  const v = p ?? fallback;
  if (v === 'none') return undefined;
  return v === 'line' ? stroke.paint : v;
}

function commandFor(
  entry: MarkerEntry, ref: MarkerRef, stroke: Stroke, strokeWidth: number, site: MarkerSite,
): PathDrawCommand | null {
  const size = resolveMarkerSize(ref, strokeWidth);
  const geometry = entry.path({ size, stroke });
  const angle = entry.orient === undefined || entry.orient === 'auto' ? site.angle : entry.orient;
  const path = placed(geometry, { ...site, angle });

  const fill = resolvePaint(entry.fill, stroke, 'line');
  const outline = entry.outline
    ? {
        paint: resolvePaint(entry.outline.paint, stroke, 'line'),
        width: entry.outline.width * size,
      }
    : null;
  if (fill === undefined && (outline === null || outline.paint === undefined)) return null;

  return {
    kind: 'path',
    path,
    ...(fill ? { fill } : {}),
    ...(outline && outline.paint
      ? { stroke: { paint: outline.paint, width: outline.width, cap: 'round', join: 'round' } }
      : {}),
  };
}

/**
 * Every marker command for `path` under `stroke`. `strokeWidth` is the already
 * width-resolved stroke width; `flattenTolerance` matches what the ribbon used,
 * so markers land on the same flattened vertices the stroke did.
 */
export function markerDrawCommands(
  path: Path,
  stroke: Stroke,
  strokeWidth: number,
  flattenTolerance: number | undefined,
): PathDrawCommand[] {
  const want = {
    start: stroke.markerStart !== undefined,
    mid: stroke.markerMid !== undefined,
    end: stroke.markerEnd !== undefined,
  };
  if (!want.start && !want.mid && !want.end) return [];

  const refFor = (role: MarkerSite['role']): MarkerRef | undefined =>
    role === 'start' ? stroke.markerStart : role === 'mid' ? stroke.markerMid : stroke.markerEnd;

  const out: PathDrawCommand[] = [];
  for (const pl of extractPolylines(path, { flattenTolerance })) {
    for (const site of markerSites(pl, want)) {
      const ref = refFor(site.role);
      if (ref === undefined) continue;
      const entry = getMarker(markerKeyOf(ref));
      if (entry === undefined) continue;
      const cmd = commandFor(entry, ref, stroke, strokeWidth, site);
      if (cmd) out.push(cmd);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/features/paths/markerCommands.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/paths/markerCommands.ts packages/core/src/features/paths/markerCommands.test.ts
git commit -m "build draw commands for stroke markers"
```

---

## Task 9: Paint markers from the node painter, and grow the ink

**Files:**
- Modify: `packages/core/src/canvas/NodeShape.ts` — `PATH_PAINTER.paint` (~line 565), `inkReach` (~line 538)
- Test: `packages/core/src/canvas/NodeShape.markers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/canvas/NodeShape.markers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findNodeShape } from './NodeShape';
import { PATH_M, PATH_L, type PolygonPath } from '../core/geometry/path';

const LINE: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L]),
  coords: new Float32Array([0, 0, 100, 0]),
  fillRule: 'nonzero',
};
const POSE = { x: 0, y: 0, w: 100, h: 1, rotation: 0 };

function nodeWith(stroke: unknown) {
  return { id: 'n1', data: { path: LINE, fill: null, stroke } } as never;
}

describe('markers on a path node', () => {
  it('emits only the stroke command when no marker is set', () => {
    const node = nodeWith({ paint: { fill: 'solid', color: '#000' }, width: 2 });
    const cmds = findNodeShape(node)!.paint!(node, POSE as never, {} as never);
    expect(cmds).toHaveLength(1);
  });

  it('appends a command for the marker', () => {
    const node = nodeWith({ paint: { fill: 'solid', color: '#000' }, width: 2, markerEnd: 'arrow' });
    const cmds = findNodeShape(node)!.paint!(node, POSE as never, {} as never);
    expect(cmds).toHaveLength(2);
  });

  it('draws the marker after the stroke, so it sits on top', () => {
    const node = nodeWith({
      paint: { fill: 'solid', color: '#000' }, width: 2,
      markerStart: 'arrow', markerEnd: 'arrow',
    });
    const cmds = findNodeShape(node)!.paint!(node, POSE as never, {} as never);
    expect(cmds).toHaveLength(3);
    expect((cmds[0] as { stroke?: unknown }).stroke).toBeDefined();
  });

  it('reaches past the path end for hit-testing', () => {
    const plain = nodeWith({ paint: { fill: 'solid', color: '#000' }, width: 2 });
    const marked = nodeWith({
      paint: { fill: 'solid', color: '#000' }, width: 2, markerEnd: 'arrow',
    });
    const inkOf = (n: unknown) =>
      findNodeShape(n as never)!.ink!(n as never, POSE as never, { scale: 1 } as never);
    expect(inkOf(marked)!.outset).toBeGreaterThan(inkOf(plain)!.outset);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/canvas/NodeShape.markers.test.ts`
Expected: FAIL — the second test gets 1 command, not 2.

- [ ] **Step 3: Emit the commands**

In `packages/core/src/canvas/NodeShape.ts`, add imports:

```ts
import { markerDrawCommands } from '../features/paths/markerCommands';
import { markerInset } from '../core/markerInset';
```

In `PATH_PAINTER.paint`, replace the single-command return:

```ts
    const cmd: DrawCommand = {
      kind: 'path',
      path: projected,
      ...(fill ? { fill } : {}),
      ...(stroke ? { stroke } : {}),
    };
    return [cmd];
```

with:

```ts
    const cmd: DrawCommand = {
      kind: 'path',
      path: projected,
      ...(fill ? { fill } : {}),
      ...(stroke ? { stroke } : {}),
    };
    if (!stroke) return [cmd];
    // Markers paint after the ribbon so they sit on top of it.
    const width = resolveStrokeWidth(stroke.width ?? 1, 1);
    return [cmd, ...markerDrawCommands(projected, stroke, width, undefined)];
```

- [ ] **Step 4: Grow `inkReach`**

Replace `inkReach` in the same file:

```ts
/** Per-side grab reach for a resolved stroke, in world units. */
function inkReach(
  stroke: Stroke | null,
  scale: number | undefined,
): { outset: number; inset: number } {
  if (stroke === null) return { outset: 0, inset: 0 };
  const w = resolveStrokeWidth(stroke.width ?? 1, scale ?? 1);
  // A marker paints past the path's own end, and the kit's rule is that
  // visible chrome is hittable — so the reach has to cover it.
  const reach = Math.max(
    markerInset(stroke.markerStart, w),
    markerInset(stroke.markerEnd, w),
    markerInset(stroke.markerMid, w),
  );
  switch (stroke.align ?? 'center') {
    case 'inner':
      return { outset: reach, inset: w };
    case 'outer':
      return { outset: w + reach, inset: 0 };
    default:
      return { outset: w / 2 + reach, inset: w / 2 };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/canvas/NodeShape.markers.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Run the kit suite**

Run: `npx vitest run --project=kit`
Expected: PASS. `NodeShape.ink.test.ts` asserts `paint` and `ink` agree — if it fails, the two branches have diverged and both need the marker case.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/canvas/NodeShape.ts packages/core/src/canvas/NodeShape.markers.test.ts
git commit -m "paint stroke markers and extend ink reach to cover them"
```

---

## Task 10: Barrel exports

**Files:**
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/strokeMarkers.smoke.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/strokeMarkers.smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as kit from './index';

describe('stroke markers are public API', () => {
  it('exports the registry surface', () => {
    expect(typeof kit.registerMarker).toBe('function');
    expect(typeof kit.getMarker).toBe('function');
    expect(typeof kit.listMarkers).toBe('function');
  });

  it('exports the geometry helpers a consumer needs', () => {
    expect(typeof kit.markerSites).toBe('function');
    expect(typeof kit.markerDrawCommands).toBe('function');
    expect(typeof kit.markerInset).toBe('function');
  });

  it('re-exports the marker types from paint', () => {
    const stroke: kit.Stroke = { paint: { fill: 'solid', color: '#000' }, markerEnd: 'arrow' };
    expect(stroke.markerEnd).toBe('arrow');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/strokeMarkers.smoke.test.ts`
Expected: FAIL — `kit.registerMarker is not a function`.

- [ ] **Step 3: Add the exports**

In `packages/core/src/index.ts`, beside the existing `registerPaintKind` block (~line 759):

```ts
export {
  registerMarker, getMarker, listMarkers, _resetMarkersForTests,
} from './core/strokeMarkers';
export type { MarkerEntry, MarkerCtx, MarkerPaint } from './core/strokeMarkers';
export { markerInset, markerKeyOf, resolveMarkerSize, strokeInsets } from './core/markerInset';
export { markerSites } from './features/paths/markerSites';
export type { MarkerSite, MarkerSiteRequest } from './features/paths/markerSites';
export { markerDrawCommands } from './features/paths/markerCommands';
export { BUILTIN_MARKERS } from './features/paths/strokeMarkerShapes';
export { trimPolyline } from './features/paths/tessellate/trim';
```

Add `KitMarkerKey`, `MarkerKey`, `MarkerRef` to the existing named re-export of `@weasel-js/paint` types (~line 619). Re-export **by name** — a star re-export of an external package emits no binding in the bundle and only `npm run test:smoke:consumer` catches it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/strokeMarkers.smoke.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/strokeMarkers.smoke.test.ts
git commit -m "export the stroke marker surface from core"
```

---

## Task 11: SVG parse

**Files:**
- Modify: `packages/svg/src/types.ts:72-88` (`SvgStroke`)
- Modify: `packages/svg/src/cascade.ts:28-34` (`INHERITABLE`)
- Modify: `packages/svg/src/parse.ts:484` (`readStroke`), `:532` (`STROKE_KEYS`), `:555` (`coreStroke`), `:38` (`IGNORED_TAGS`)
- Modify: `packages/svg/src/gradients.ts:37` (`warnUnsupportedDefsChildren`)
- Modify: `packages/svg/src/unpack.ts:112` (`strokeDataFromSvg`)
- Test: `packages/svg/src/markers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/svg/src/markers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseSvg } from './parse';

const wrap = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">${body}</svg>`;

describe('marker parsing', () => {
  it('reads a known key off marker-end', () => {
    const { nodes } = parseSvg(wrap(
      '<line x1="0" y1="0" x2="50" y2="0" stroke="#000" marker-end="url(#arrow)"/>',
    ));
    expect(nodes[0].stroke?.markerEnd).toBe('arrow');
  });

  it('reads all three positions', () => {
    const { nodes } = parseSvg(wrap(
      '<polyline points="0,0 25,25 50,0" stroke="#000" ' +
      'marker-start="url(#circle)" marker-mid="url(#square)" marker-end="url(#arrow)"/>',
    ));
    expect(nodes[0].stroke?.markerStart).toBe('circle');
    expect(nodes[0].stroke?.markerMid).toBe('square');
    expect(nodes[0].stroke?.markerEnd).toBe('arrow');
  });

  it('inherits markers from a parent group', () => {
    const { nodes } = parseSvg(wrap(
      '<g stroke="#000" marker-end="url(#arrow)"><line x1="0" y1="0" x2="50" y2="0"/></g>',
    ));
    expect(nodes[0].stroke?.markerEnd).toBe('arrow');
  });

  it('treats marker-end="none" as absent', () => {
    const { nodes } = parseSvg(wrap(
      '<line x1="0" y1="0" x2="50" y2="0" stroke="#000" marker-end="none"/>',
    ));
    expect(nodes[0].stroke?.markerEnd).toBeUndefined();
  });

  it('warns and drops a marker we have no key for', () => {
    const { nodes, warnings } = parseSvg(wrap(
      '<defs><marker id="custom"><path d="M0 0 L5 5"/></marker></defs>' +
      '<line x1="0" y1="0" x2="50" y2="0" stroke="#000" marker-end="url(#custom)"/>',
    ));
    expect(nodes[0].stroke?.markerEnd).toBeUndefined();
    expect(warnings.join(' ')).toContain('custom');
  });

  it('does not warn about a <marker> def on its own', () => {
    const { warnings } = parseSvg(wrap(
      '<defs><marker id="arrow"><path d="M0 0 L5 5"/></marker></defs>' +
      '<line x1="0" y1="0" x2="50" y2="0" stroke="#000" marker-end="url(#arrow)"/>',
    ));
    expect(warnings.filter((w) => w.includes('unsupported'))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/svg/src/markers.test.ts`
Expected: FAIL — `expected undefined to be 'arrow'`.

- [ ] **Step 3: Add the field to `SvgStroke`**

In `packages/svg/src/types.ts`, inside `SvgStroke`:

```ts
  markerStart?: string;
  markerMid?: string;
  markerEnd?: string;
```

- [ ] **Step 4: Make them inheritable**

In `packages/svg/src/cascade.ts`, add to `INHERITABLE`:

```ts
  'marker-start', 'marker-mid', 'marker-end',
```

- [ ] **Step 5: Read them**

In `packages/svg/src/parse.ts`, add to `STROKE_KEYS`:

```ts
  'marker-start', 'marker-mid', 'marker-end',
```

Add the reference parser near `parseDashArray`:

```ts
/** `url(#id)` → `id`; `none`, an empty value, or anything else → undefined. */
function parseMarkerRef(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (v === '' || v === 'none') return undefined;
  const m = /^url\(\s*#([^)\s]+)\s*\)/.exec(v);
  return m ? m[1] : undefined;
}
```

Inside `readStroke`, after the `dash` handling, add — noting that `readStroke` early-returns when neither `stroke` nor `stroke-width` is set, so a marker-only element still yields no stroke, which is correct (there is no line to mark):

```ts
  for (const [attr, field] of [
    ['marker-start', 'markerStart'],
    ['marker-mid', 'markerMid'],
    ['marker-end', 'markerEnd'],
  ] as const) {
    const id = parseMarkerRef(ctx[attr]);
    if (id === undefined) continue;
    if (getMarker(id) === undefined) {
      onWarn?.(`${attr} references a marker this kit has no entry for: #${id}`);
      continue;
    }
    out[field] = id;
  }
```

with `import { getMarker } from '@weasel-js/core';` at the top.

In `coreStroke`, carry the three fields across the same way the existing optional fields are carried:

```ts
  if (stroke.markerStart) out.markerStart = stroke.markerStart;
  if (stroke.markerMid) out.markerMid = stroke.markerMid;
  if (stroke.markerEnd) out.markerEnd = stroke.markerEnd;
```

Add `'marker'` to `IGNORED_TAGS` at `parse.ts:38`, so a `<marker>` met during the geometry walk is skipped rather than reported as an unsupported element.

- [ ] **Step 6: Stop warning about the def**

In `packages/svg/src/gradients.ts`, in `warnUnsupportedDefsChildren`, extend the allow-list:

```ts
      if (GRADIENT_TAGS.has(tag) || tag === 'pattern' || tag === 'marker') continue;
```

- [ ] **Step 7: Carry it through `strokeDataFromSvg`**

In `packages/svg/src/unpack.ts`, add to the spread chain in `strokeDataFromSvg`:

```ts
    ...(stroke.markerStart !== undefined ? { markerStart: stroke.markerStart } : {}),
    ...(stroke.markerMid !== undefined ? { markerMid: stroke.markerMid } : {}),
    ...(stroke.markerEnd !== undefined ? { markerEnd: stroke.markerEnd } : {}),
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/svg/src/markers.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 9: Commit**

```bash
git add packages/svg/src/types.ts packages/svg/src/cascade.ts packages/svg/src/parse.ts packages/svg/src/gradients.ts packages/svg/src/unpack.ts packages/svg/src/markers.test.ts
git commit -m "parse marker presentation attributes"
```

---

## Task 12: SVG serialize

**Files:**
- Modify: `packages/svg/src/serialize.ts:118` (`registerPaintServers`), `:265` (`coreStrokeAttrs`), `:290` (`strokeAttrsFor`)
- Modify: `packages/svg/src/gradients.ts` (`PaintServerRegistry`)
- Test: `packages/svg/src/markerSerialize.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/svg/src/markerSerialize.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { serializeSvg } from './serialize';
import { parseSvg } from './parse';

const line = (extra: Record<string, unknown> = {}) => [{
  kind: 'path' as const,
  d: 'M0 0 L50 0',
  stroke: { paint: { kind: 'solid' as const, color: '#000' }, width: 2, ...extra },
}];

describe('marker serialization', () => {
  it('emits the attribute and a matching def', () => {
    const out = serializeSvg(line({ markerEnd: 'arrow' }) as never);
    expect(out).toMatch(/marker-end="url\(#[^)]+\)"/);
    const id = /marker-end="url\(#([^)]+)\)"/.exec(out)![1];
    expect(out).toContain(`<marker id="${id}"`);
    expect(out.indexOf('<defs>')).toBeLessThan(out.indexOf('marker-end='));
  });

  it('emits one def for a key used many times', () => {
    const many = [...line({ markerEnd: 'arrow' }), ...line({ markerEnd: 'arrow' })];
    const out = serializeSvg(many as never);
    expect(out.match(/<marker /g)).toHaveLength(1);
  });

  it('emits full-length path data, not the trimmed geometry', () => {
    const out = serializeSvg(line({ markerEnd: 'arrow' }) as never);
    expect(out).toContain('M0 0 L50 0');
  });

  it('round-trips every position', () => {
    const svg = serializeSvg(
      line({ markerStart: 'circle', markerMid: 'square', markerEnd: 'arrow' }) as never,
    );
    const { nodes, warnings } = parseSvg(svg);
    expect(warnings).toEqual([]);
    expect(nodes[0].stroke?.markerStart).toBe('circle');
    expect(nodes[0].stroke?.markerMid).toBe('square');
    expect(nodes[0].stroke?.markerEnd).toBe('arrow');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/svg/src/markerSerialize.test.ts`
Expected: FAIL — no `marker-end` attribute in the output.

- [ ] **Step 3: Let the registry hold marker defs**

In `packages/svg/src/gradients.ts`, extend `PaintServerRegistry` with a marker table keyed by **marker key**, not by object identity — one arrowhead reused across hundreds of edges must emit one def:

```ts
  private markers = new Map<string, string>();   // marker key -> generated id

  /** The `<defs>` id for a marker key, minting one on first use. */
  markerId(key: string): string {
    const existing = this.markers.get(key);
    if (existing) return existing;
    const id = `mark${this.markers.size}`;
    this.markers.set(key, id);
    return id;
  }
```

and in `toDefsXml()`, append the marker defs after the paint-server ones:

```ts
    for (const [key, id] of this.markers) {
      const entry = getMarker(key);
      if (!entry) continue;
      parts.push(entry.toSvg ? entry.toSvg(id, entry) : defaultMarkerXml(id, entry));
    }
```

Add `defaultMarkerXml` beside it — geometry at size 1, anchor at the origin, with `orient="auto"` and `overflow="visible"` so a head is never clipped by its own viewport:

```ts
/** The `<marker>` def for an entry with no `toSvg` of its own. */
function defaultMarkerXml(id: string, entry: MarkerEntry): string {
  const path = entry.path({ size: 1, stroke: { paint: { fill: 'solid', color: '#000' } } });
  const d = serializePathD(path);
  const fill = entry.fill === 'none' ? 'none' : 'context-stroke';
  const outline = entry.outline
    ? ` stroke="context-stroke" stroke-width="${entry.outline.width}" stroke-linecap="round" stroke-linejoin="round"`
    : '';
  return (
    `<marker id="${id}" markerUnits="strokeWidth" markerWidth="8" markerHeight="8"` +
    ` refX="0" refY="0" orient="auto" overflow="visible">` +
    `<path d="${d}" fill="${fill}"${outline}/></marker>`
  );
}
```

Import `getMarker`, `type MarkerEntry` from `@weasel-js/core` and `serializePathD` from
`./path-serializer` — it is already its own exported module, so `gradients.ts` can import it
directly with no cycle. Do not reimplement `d` emission.

- [ ] **Step 4: Emit the attributes**

Add to **both** `coreStrokeAttrs` and `strokeAttrsFor` — they are near-duplicates and do not share a code path:

```ts
  for (const [field, attr] of [
    ['markerStart', 'marker-start'],
    ['markerMid', 'marker-mid'],
    ['markerEnd', 'marker-end'],
  ] as const) {
    const ref = stroke[field];
    if (ref === undefined) continue;
    const key = typeof ref === 'string' ? ref : ref.key;
    attrs.push(`${attr}="url(#${registry.markerId(key)})"`);
  }
```

- [ ] **Step 5: Register markers in the pre-pass**

In `serialize.ts`, beside `registerTextPaint`:

```ts
/** A marker reference in either shape — `SvgStroke` stores a bare key, the kit
 *  `Stroke` stores a `MarkerRef`. */
function markerKeyOfRef(ref: unknown): string | undefined {
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object' && 'key' in ref) return String((ref as { key: string }).key);
  return undefined;
}

/** Mint a `<defs>` id for every marker a stroke names, before the body is
 *  written — same reason as the paint pre-pass: `<defs>` is emitted first, so a
 *  marker first seen mid-body would be referenced by an id no definition backs. */
function registerMarkers(stroke: { markerStart?: unknown; markerMid?: unknown; markerEnd?: unknown } | undefined,
                         registry: PaintServerRegistry): void {
  if (!stroke) return;
  for (const ref of [stroke.markerStart, stroke.markerMid, stroke.markerEnd]) {
    const key = markerKeyOfRef(ref);
    if (key) registry.markerId(key);
  }
}
```

Then call it from both node branches of `registerPaintServers` (`serialize.ts:118`):

```ts
    } else if (n.kind === 'path') {
      if (n.fill.kind === 'gradient') registry.register(n.fill.paint);
      if (n.stroke && n.stroke.paint.kind === 'gradient') registry.register(n.stroke.paint.paint);
      registerMarkers(n.stroke, registry);
    } else if (n.kind === 'text') {
      registerTextPaint(n.fill, registry);
      registerTextPaint(n.stroke?.paint, registry);
      registerMarkers(n.stroke, registry);
      for (const run of n.runs ?? []) {
        registerTextPaint(run.fill, registry);
        registerTextPaint(run.stroke?.paint, registry);
      }
    }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/svg/src/markerSerialize.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/svg/src/serialize.ts packages/svg/src/gradients.ts packages/svg/src/markerSerialize.test.ts
git commit -m "emit marker attributes and defs on export"
```

---

## Task 13: Round-trip coverage

**Files:**
- Modify: `packages/svg/src/__fixtures__/fixtures.ts`
- Modify: `packages/svg/src/roundtrip.test.ts`
- Modify: `packages/svg/src/roundtrip-property.test.ts:59-68`
- Modify: `packages/svg/src/warnings.test.ts`

- [ ] **Step 1: Add the fixture**

In `packages/svg/src/__fixtures__/fixtures.ts`, beside `STROKE_STYLE_SVG`:

```ts
export const MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120">
  <defs>
    <marker id="arrow" markerUnits="strokeWidth" markerWidth="8" markerHeight="8"
      refX="0" refY="0" orient="auto" overflow="visible">
      <path d="M0 0 L-3 -1.5 L-3 1.5 Z" fill="context-stroke"/>
    </marker>
  </defs>
  <line x1="10" y1="20" x2="180" y2="20" stroke="#000" stroke-width="2" marker-end="url(#arrow)"/>
  <polyline points="10,60 90,90 180,60" fill="none" stroke="#000" stroke-width="3"
    marker-start="url(#arrow)" marker-mid="url(#arrow)" marker-end="url(#arrow)"/>
</svg>`;
```

- [ ] **Step 2: Add the round-trip case**

In `packages/svg/src/roundtrip.test.ts`, beside the existing stroke-styling case:

```ts
it('stroke markers (start, mid, end)', () => {
  const { a, b, warnings } = roundTrip(F.MARKER_SVG);
  expect(warnings).toEqual([]);
  expect(b).toEqual(a);
});
```

`normalize()` copies `node.stroke` wholesale, so the new fields compare with no harness change.

- [ ] **Step 3: Extend the property generator**

In `packages/svg/src/roundtrip-property.test.ts`, in the stroke generator (~line 59):

```ts
  const MARKER_KEYS = ['arrow', 'arrow-open', 'diamond', 'circle', 'bar'];
  if (rand() < 0.3) stroke.markerStart = MARKER_KEYS[(rand() * MARKER_KEYS.length) | 0];
  if (rand() < 0.2) stroke.markerMid = MARKER_KEYS[(rand() * MARKER_KEYS.length) | 0];
  if (rand() < 0.4) stroke.markerEnd = MARKER_KEYS[(rand() * MARKER_KEYS.length) | 0];
```

- [ ] **Step 4: Update the warnings test**

In `packages/svg/src/warnings.test.ts`, replace any expectation that a `<marker>` def warns:

```ts
it('accepts a <marker> def for a known key without warning', () => {
  const { warnings } = parseSvg(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<defs><marker id="arrow"><path d="M0 0 L-3 0"/></marker></defs>' +
    '<line x1="0" y1="0" x2="10" y2="0" stroke="#000" marker-end="url(#arrow)"/></svg>',
  );
  expect(warnings).toEqual([]);
});

it('warns once for a marker key it has no entry for', () => {
  const { warnings } = parseSvg(
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<defs><marker id="weird"><path d="M0 0 L-3 0"/></marker></defs>' +
    '<line x1="0" y1="0" x2="10" y2="0" stroke="#000" marker-end="url(#weird)"/></svg>',
  );
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain('weird');
});
```

- [ ] **Step 5: Run the svg suite**

Run: `npx vitest run --project=weasel-ui packages/svg`
Expected: PASS. The property test asserts zero warnings, so an unhandled marker fails there first.

- [ ] **Step 6: Commit**

```bash
git add packages/svg/src/__fixtures__/fixtures.ts packages/svg/src/roundtrip.test.ts packages/svg/src/roundtrip-property.test.ts packages/svg/src/warnings.test.ts
git commit -m "cover stroke markers in the svg round-trip suite"
```

---

## Task 14: Demo and visual baseline

The inset is invisible to a geometry test and obvious in a render. Baselines are captured from a demo route, so the demo has to exist first.

**Files:**
- Create: `apps/site/demos/StrokeMarkersDemo.tsx`
- Modify: `apps/site/registry.ts`
- Create: `tests/visual/stroke-markers.spec.ts`

- [ ] **Step 1: Write the demo**

Create `apps/site/demos/StrokeMarkersDemo.tsx`:

```tsx
import {
  asNodeId,
  pathFromD,
  SceneCanvas,
  useScene,
  useSelection,
} from '@weasel-js/core';
import type { MarkerKey, Path, Stroke } from '@weasel-js/core';

const W = 540, H = 460;
const INK = { fill: 'solid', color: '#1a130d' } as const;

/** A shallow chevron, so `marker-mid` has an interior authored vertex to sit
 *  on and `orient` has a corner to bisect. */
const CHEVRON: Path = pathFromD('M0 22 L110 0 L220 22');

const KEYS: MarkerKey[] = [
  'arrow', 'arrow-open', 'arrow-concave', 'diamond',
  'diamond-hollow', 'circle', 'square', 'bar',
];

type Leaf = {
  kind: 'leaf';
  layer: 'default';
  id: ReturnType<typeof asNodeId>;
  pose: { x: number; y: number; w: number; h: number; rotation: number };
  data: { path: Path; fill: null; stroke: Stroke };
};

const leaf = (id: string, y: number, stroke: Stroke): Leaf => ({
  kind: 'leaf',
  layer: 'default',
  id: asNodeId(id),
  pose: { x: 40, y, w: 220, h: 22, rotation: 0 },
  data: { path: CHEVRON, fill: null, stroke },
});

const NODES: Leaf[] = [
  // One row per built-in key, each on `markerEnd`.
  ...KEYS.map((key, i) => leaf(key, 30 + i * 40, {
    paint: INK, width: 3, markerEnd: key,
  })),
  // All three positions at once.
  leaf('all-three', 30 + KEYS.length * 40, {
    paint: INK, width: 3,
    markerStart: 'circle', markerMid: 'diamond', markerEnd: 'arrow',
  }),
  // A thick translucent stroke, where the inset is plainly visible: without
  // it the ribbon would run under the head and out through the tip.
  leaf('inset-proof', 70 + KEYS.length * 40, {
    paint: { fill: 'solid', color: '#b3452e', opacity: 0.55 },
    width: 12, markerEnd: 'arrow',
  }),
];

export function StrokeMarkersDemo() {
  // No `layers.scene.drawOne` on purpose: supplying one replaces the built-in
  // painter dispatch, and markers would silently never paint.
  const scene = useScene<Leaf['data'], 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: NODES,
  });
  const selection = useSelection({ initial: [] });

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selection={selection}
    />
  );
}
```

If `useScene`'s generic arity or the leaf shape does not typecheck against the current
signature, read `apps/site/demos/PathPoseDemo.tsx` and match its `useScene` call rather than
guessing — it is the closest neighbour that puts a `Path` in a node.

- [ ] **Step 2: Register it**

In `apps/site/registry.ts`, beside the other `Geometry` entries:

```ts
  {
    id: 'stroke-markers',
    title: 'Stroke markers',
    category: 'Geometry',
    description: 'Arrowheads and line terminators as stroke style — `markerStart` / `markerMid` / `markerEnd` on a Stroke, resolved through the marker registry. Each entry declares its own inset, so the ribbon stops at a filled head\'s base instead of spiking through its tip the way SVG does, while an open V still reaches the vertex. The bottom row is a thick translucent stroke where that inset is visible.',
    hint: 'Every head takes the line\'s own paint; no second definition per color.',
    load: () => import('./demos/StrokeMarkersDemo').then((m) => m.StrokeMarkersDemo),
    path: 'apps/site/demos/StrokeMarkersDemo.tsx',
  },
```

- [ ] **Step 3: Verify it renders in a browser**

Run the dev server in the background and open the route — jsdom cannot catch a layout collapse, and `useScene` seeds `initial` once so HMR keeps the old scene. Hard-reload before trusting what you see.

```bash
npm run dev:kit
```

Open `http://localhost:5173/#stroke-markers`. Confirm: every head renders, filled heads are not speared by their own line, and the open V's arms meet the line with no gap.

- [ ] **Step 4: Write the visual spec**

Create `tests/visual/stroke-markers.spec.ts`:

```ts
/**
 * Visual regression spec: stroke markers demo.
 *
 * The inset is invisible to a geometry test and obvious in a render — a filled
 * head whose line spikes through the tip passes every unit test in the suite.
 *
 * Interaction sequence:
 *   1. Initial mount — capture the static vocabulary board.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline } from './diff.js';

const DEMO_ID = 'stroke-markers';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

test(`${DEMO_ID} — visual baseline`, async ({ page }) => {
  const png = await captureCanvas(page, `/#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}.png`));
});
```

- [ ] **Step 5: Generate and eyeball the baseline**

Run the visual suite to produce `tests/visual/baselines/stroke-markers.png`, then **open the PNG and look at it** before committing — a baseline captured from a broken render locks the bug in.

```bash
open tests/visual/baselines/stroke-markers.png
```

Note: a local pass does not imply a CI pass. Chromium anti-aliases hairline 2D strokes only on GPU, so hairline geometry can diverge between local and CI.

- [ ] **Step 6: Commit**

```bash
git add apps/site/demos/StrokeMarkersDemo.tsx apps/site/registry.ts tests/visual/stroke-markers.spec.ts tests/visual/baselines/stroke-markers.png
git commit -m "demo stroke markers and capture a visual baseline"
```

---

## Task 15: Property panel, TODO, changeset

**Files:**
- Modify: `packages/core/src/canvas/SceneCanvas/defaultNodeProperties.ts:96-121`
- Modify: `docs/TODO.md`
- Create: `.changeset/stroke-markers.md`

- [ ] **Step 1: Add the schema leaves**

In `defaultNodeProperties.ts`, beside `strokeDashEncoding` (`:31-45`), which is the existing
enum-over-a-stored-value pattern:

```ts
/** `Stroke.markerStart` / `markerMid` / `markerEnd` — a `MarkerRef` — read and
 *  written as a bare key, with the empty string standing for no marker. */
const markerEncoding: ToolPrefEnumEncoding = {
  read: (ref) => {
    if (typeof ref === 'string') return ref;
    if (ref && typeof ref === 'object' && 'key' in ref) return String((ref as { key: string }).key);
    return '';
  },
  write: (value) => (value === '' ? undefined : value),
};

/** Options come from the registry, so a consumer's registered entry appears in
 *  the picker with no kit edit. A `select` rather than a `toggle`: nine options
 *  will not fit a segmented strip. */
const markerOptions = () => [
  { value: '', label: 'None' },
  ...listMarkers().map((m) => ({ value: m.id, label: m.id })),
];
```

Then add three children to the `data.stroke` object leaf, after `dash`:

```ts
              markerStart: { kind: 'enum', name: 'Start', description: 'Marker at the first vertex of each open subpath.', default: '', control: 'select', block: true, pair: 'Markers', encoding: markerEncoding, options: markerOptions() },
              markerMid: { kind: 'enum', name: 'Mid', description: 'Marker at every interior authored vertex.', default: '', control: 'select', block: true, pair: 'Markers', encoding: markerEncoding, options: markerOptions() },
              markerEnd: { kind: 'enum', name: 'End', description: 'Marker at the last vertex of each open subpath.', default: '', control: 'select', block: true, pair: 'Markers', encoding: markerEncoding, options: markerOptions() },
```

with `listMarkers` imported from `../../core/strokeMarkers`.

**No marker icons in this arc.** The other stroke enums are icon-toggles, but eight glyphs
authored to `docs/CLAUDE.md`'s standard — proofed at 10–15×, then checked separately on the 1×
and 2× pixel grids — is its own piece of work. Labels-in-a-select is honest until then.

- [ ] **Step 2: Retire the TODO entry**

`docs/TODO.md` — arc 2 of the diagram plugin is no longer pending. Update both the entry and the hand-maintained index at the top of the file; per `docs/CLAUDE.md`, fix both or fix neither.

- [ ] **Step 3: Write the changeset**

Create `.changeset/stroke-markers.md`:

```markdown
---
'@weasel-js/core': patch
'@weasel-js/paint': patch
'@weasel-js/svg': patch
---

Add stroke markers — arrowheads and other line terminators as stroke style.

`markerStart` / `markerMid` / `markerEnd` on `Stroke` take a key resolved
through a new registry (`registerMarker`), shipping eight built-in shapes.
Unlike SVG, the stroke stops short of a filled head rather than running under
it to the tip; the distance is declared per marker, so an open V still reaches
the vertex. Round-trips through `@weasel-js/svg` as `marker-*` attributes plus
`<marker>` defs.
```

**`patch`, always.** Never write `minor` or `major` in a weasel changeset, and never write a `bump-approved` marker — both need Mike's explicit OK in conversation. All thirteen packages are one `fixed` group, so any bump moves every package.

- [ ] **Step 4: Full verification**

```bash
npx tsc --noEmit
npx vitest run
npm run check:bumps
npm run check:frame-loops
npm run check:manifests
```

Expected: all clean. `check:manifests` is the only check that catches an undeclared dependency — the consumer smoke test cannot, because it packs every `@weasel-js` package into the tree.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/canvas/SceneCanvas/defaultNodeProperties.ts docs/TODO.md .changeset/stroke-markers.md
git commit -m "surface markers in the property panel and retire the arc-2 todo"
```
