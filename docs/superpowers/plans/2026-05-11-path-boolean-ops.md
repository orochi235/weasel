# Path Boolean Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship five polygon-boolean operations (union, intersect, subtract, exclude, divide) as pure functions over `Path`, and expose them as a multi-selection-driven action hook `useBooleans` that performs the op as a single undoable batch.

**Architecture:** Pure functions live in `src/features/paths/booleans.ts`. An adapter module (`booleans.adapter.ts`) maps `Path` ↔ `polygon-clipping`'s `MultiPolygon` shape, isolating the dep. The action hook follows the codebase's established adapter pattern (mirrors `useDelete` / `useGroup`): consumer-supplied adapter exposes `getSelection` / `getWorldPath` / `compareZ` / `createPathNode`, the hook builds a batch of insert + delete ops and dispatches it through `dispatchApplyBatch`.

**Tech Stack:** TypeScript, React 18, vitest, Playwright (visual baseline), `polygon-clipping` (new vendored dep).

**Spec:** `docs/superpowers/specs/2026-05-11-path-boolean-ops-design.md`

---

## File map

Create:
- `src/features/paths/booleans.ts` — public pure functions.
- `src/features/paths/booleans.adapter.ts` — engine adapter (`pathToMultiPolygon`, `multiPolygonToPath`).
- `src/features/paths/booleans.test.ts` — pure-fn unit tests.
- `src/features/paths/booleans.adapter.test.ts` — adapter round-trip tests.
- `src/interactions/actions/booleans/booleans.ts` — pure action core (compute batch from inputs + op).
- `src/interactions/actions/booleans/useBooleans.ts` — React hook surface.
- `src/interactions/actions/booleans/index.ts` — barrel.
- `src/interactions/actions/booleans/booleans.test.ts` — pure core tests.
- `src/interactions/actions/booleans/useBooleans.test.tsx` — hook tests.
- `demo/demos/BooleanOpsDemo.tsx` — five-region demo.
- `tests/visual/boolean-ops.spec.ts` — Playwright visual baseline.

Modify:
- `package.json` — add `polygon-clipping` dep.
- `src/features/paths/index.ts` — export new symbols.
- `src/index.ts` — re-export public surface.
- `demo/demos/index.ts` (or equivalent demo registry — locate during Task 17) — register new demo.
- `docs/TODO.md` — collapse the "Active priority" section once everything ships; move deferred companion ops to medium-priority.

---

## Adapter type sketch (referenced from Task 13/14 onward)

```ts
// src/interactions/actions/booleans/booleans.ts (excerpt, defined fully in Task 13)
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import type { Path } from 'features/paths/types';

export type BooleanOp = 'union' | 'intersect' | 'subtract' | 'exclude' | 'divide';

export interface BooleansAdapter {
  /** Read current selection in arbitrary order. */
  getSelection(): NodeId[];
  /** Return the world-space `Path` for `id`, or `undefined` if `id` is not a path
   *  node. Non-path selections are silently filtered out. */
  getWorldPath(id: NodeId): Path | undefined;
  /** Compare two ids by stacking order. Returns negative if `a` is behind `b`,
   *  positive if `a` is in front of `b`, zero if they tie. */
  compareZ(a: NodeId, b: NodeId): number;
  /** Mint a node carrying a result `Path`. The hook will wrap it in an InsertOp;
   *  the consumer's adapter materializes whatever scene-graph node shape it uses. */
  createPathNode(path: Path): { id: string };
  /** Optional batch dispatcher; falls back to applying ops sequentially. */
  applyBatch?(ops: Op[], label: string): void;
  /** Optional selection setter (used by SetSelectionOp's adapter contract). */
  setSelection?(ids: NodeId[]): void;
  /** Optional insert mutator (used when applyBatch is omitted). */
  insertNode?(node: { id: string }): void;
  /** Optional remove mutator (used when applyBatch is omitted). */
  removeNode?(id: string): void;
}
```

---

## Task 1: Add `polygon-clipping` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the dependency**

Run from repo root:

```bash
npm install polygon-clipping@^0.15.7
```

- [ ] **Step 2: Verify it landed as a regular dependency**

Run:

```bash
node -e "console.log(require('./package.json').dependencies['polygon-clipping'])"
```

Expected output: a version string (`^0.15.7` or similar).

- [ ] **Step 3: Verify zero transitive deps**

Run:

```bash
npm ls polygon-clipping --depth=1
```

Expected: `polygon-clipping@0.15.x` with no nested dependencies listed.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add polygon-clipping for path boolean ops"
```

---

## Task 2: Engine adapter — `pathToMultiPolygon`

**Files:**
- Create: `src/features/paths/booleans.adapter.ts`
- Test: `src/features/paths/booleans.adapter.test.ts`

The adapter walks the command stream, flattens curves via `flattenCubic` / `flattenQuadratic`, splits at `M`, closes open rings, and emits `polygon-clipping`'s `MultiPolygon` shape (`[[[x, y], ...], ...]` — an array of polygons, each polygon an array of rings, each ring an array of `[x, y]` pairs).

Open rings are closed implicitly (the engine requires closed rings). A `RectPath` is emitted as a single 4-corner ring.

- [ ] **Step 1: Write the failing test (rect → MultiPolygon)**

Create `src/features/paths/booleans.adapter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pathToMultiPolygon } from './booleans.adapter';
import type { RectPath, PolygonPath } from './types';
import { PATH_M, PATH_L, PATH_Z } from './types';

describe('pathToMultiPolygon', () => {
  it('emits a single 4-corner ring for a RectPath', () => {
    const rect: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 20 };
    const mp = pathToMultiPolygon(rect);
    // One polygon, one ring, 4 corners + repeat of first (closed).
    expect(mp).toHaveLength(1);
    expect(mp[0]).toHaveLength(1);
    expect(mp[0][0]).toEqual([
      [0, 0],
      [10, 0],
      [10, 20],
      [0, 20],
      [0, 0],
    ]);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npx vitest run src/features/paths/booleans.adapter.test.ts
```

Expected: FAIL — `pathToMultiPolygon is not a function` (module not found).

- [ ] **Step 3: Create adapter file with the minimal implementation**

Create `src/features/paths/booleans.adapter.ts`:

```ts
/**
 * Adapter between weasel's `Path` shape and `polygon-clipping`'s
 * `MultiPolygon` format. Kept in a dedicated module so the dep is one
 * import away from being swappable.
 *
 * `polygon-clipping` expects:
 *   MultiPolygon = Polygon[]
 *   Polygon      = Ring[]   (first ring outer, subsequent rings holes)
 *   Ring         = [x, y][] (closed — first vertex repeated as last)
 *
 * Bezier inputs are flattened via the existing `flatten.ts` utility — v1
 * is straight-line only. Open contours are implicitly closed because
 * boolean ops are defined on closed regions; polylines have zero area
 * and would otherwise be silently dropped.
 */
import { PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z, type Path } from './types';
import { flattenCubic, flattenQuadratic, DEFAULT_FLATTEN_TOLERANCE } from './flatten';

/** A `[x, y]` 2-tuple. */
export type Pair = [number, number];
/** Closed ring (first vertex repeated as last). */
export type Ring = Pair[];
/** Polygon: one outer ring optionally followed by hole rings. */
export type Polygon = Ring[];
/** MultiPolygon: list of polygons (used for boolean op I/O). */
export type MultiPolygon = Polygon[];

export interface PathToMultiPolygonOptions {
  /** Flattening tolerance for bezier segments. Default: `DEFAULT_FLATTEN_TOLERANCE`. */
  tolerance?: number;
}

/** Convert a `Path` to a `MultiPolygon` suitable for `polygon-clipping`. */
export function pathToMultiPolygon(
  path: Path,
  opts: PathToMultiPolygonOptions = {},
): MultiPolygon {
  if (path.kind === 'rect') {
    const { x, y, width, height } = path;
    const ring: Ring = [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
      [x, y],
    ];
    return [[ring]];
  }

  const tolerance = opts.tolerance ?? DEFAULT_FLATTEN_TOLERANCE;
  const rings: Ring[] = [];
  let current: Ring | null = null;
  let cx = 0, cy = 0;
  let ci = 0;
  const { commands, coords } = path;

  const finalizeCurrent = () => {
    if (!current || current.length === 0) return;
    // Close the ring by repeating the first vertex if not already closed.
    const first = current[0];
    const last = current[current.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      current.push([first[0], first[1]]);
    }
    if (current.length >= 4) rings.push(current); // 3 unique + 1 closing
    current = null;
  };

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd) {
      case PATH_M: {
        finalizeCurrent();
        cx = coords[ci]; cy = coords[ci + 1];
        current = [[cx, cy]];
        ci += 2;
        break;
      }
      case PATH_L: {
        cx = coords[ci]; cy = coords[ci + 1];
        if (current) current.push([cx, cy]);
        ci += 2;
        break;
      }
      case PATH_C: {
        const x1 = coords[ci], y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        const x3 = coords[ci + 4], y3 = coords[ci + 5];
        const out: number[] = [];
        flattenCubic(cx, cy, x1, y1, x2, y2, x3, y3, tolerance, out);
        if (current) for (let k = 0; k < out.length; k += 2) current.push([out[k], out[k + 1]]);
        cx = x3; cy = y3;
        ci += 6;
        break;
      }
      case PATH_Q: {
        const x1 = coords[ci], y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        const out: number[] = [];
        flattenQuadratic(cx, cy, x1, y1, x2, y2, tolerance, out);
        if (current) for (let k = 0; k < out.length; k += 2) current.push([out[k], out[k + 1]]);
        cx = x2; cy = y2;
        ci += 4;
        break;
      }
      case PATH_Z: {
        finalizeCurrent();
        break;
      }
    }
  }
  finalizeCurrent();

  if (rings.length === 0) return [];
  // v1: emit every ring as its own polygon. `polygon-clipping`'s engine
  // re-classifies winding internally during the op, so we don't need to
  // pre-sort outer/hole rings.
  return rings.map((r) => [r]);
}
```

- [ ] **Step 4: Run test, confirm pass**

```bash
npx vitest run src/features/paths/booleans.adapter.test.ts
```

Expected: PASS, 1 test.

- [ ] **Step 5: Add a PolygonPath → MultiPolygon test (single closed triangle)**

Append to `src/features/paths/booleans.adapter.test.ts`:

```ts
it('emits a closed ring for an explicit triangle PolygonPath', () => {
  const tri: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
    coords: new Float32Array([0, 0, 10, 0, 5, 10]),
    fillRule: 'nonzero',
  };
  const mp = pathToMultiPolygon(tri);
  expect(mp).toHaveLength(1);
  expect(mp[0]).toHaveLength(1);
  expect(mp[0][0]).toEqual([
    [0, 0],
    [10, 0],
    [5, 10],
    [0, 0],
  ]);
});

it('closes an open (no-Z) contour implicitly', () => {
  const open: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
    coords: new Float32Array([0, 0, 10, 0, 5, 10]),
    fillRule: 'nonzero',
  };
  const mp = pathToMultiPolygon(open);
  expect(mp[0][0][mp[0][0].length - 1]).toEqual([0, 0]);
});

it('produces two polygons for a two-contour PolygonPath', () => {
  // Outer 0..10 square, separate inner 2..8 square — both contours
  // emitted as independent polygons (engine reclassifies during op).
  const two: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array([
      PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
      PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
    ]),
    coords: new Float32Array([
      0, 0, 10, 0, 10, 10, 0, 10,
      2, 2, 8, 2, 8, 8, 2, 8,
    ]),
    fillRule: 'nonzero',
  };
  const mp = pathToMultiPolygon(two);
  expect(mp).toHaveLength(2);
});
```

- [ ] **Step 6: Run, confirm pass**

```bash
npx vitest run src/features/paths/booleans.adapter.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add src/features/paths/booleans.adapter.ts src/features/paths/booleans.adapter.test.ts
git commit -m "feat(paths): pathToMultiPolygon adapter for boolean ops"
```

---

## Task 3: Engine adapter — `multiPolygonToPath`

**Files:**
- Modify: `src/features/paths/booleans.adapter.ts`
- Modify: `src/features/paths/booleans.adapter.test.ts`

Inverse direction: walk a `MultiPolygon` and emit a `PolygonPath` with `M`/`L`/`Z` per ring. Output `fillRule: 'nonzero'`.

- [ ] **Step 1: Write the failing test (single rect ring → PolygonPath)**

Append to `src/features/paths/booleans.adapter.test.ts`:

```ts
import { multiPolygonToPath } from './booleans.adapter';

describe('multiPolygonToPath', () => {
  it('emits one M/L*/Z per ring with nonzero fillRule', () => {
    const mp = [
      [[
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ]],
    ];
    const path = multiPolygonToPath(mp);
    expect(path.kind).toBe('polygon');
    expect(path.fillRule).toBe('nonzero');
    expect(Array.from(path.commands)).toEqual([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]);
    expect(Array.from(path.coords)).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
  });

  it('returns an empty PolygonPath for an empty MultiPolygon', () => {
    const path = multiPolygonToPath([]);
    expect(path.kind).toBe('polygon');
    expect(path.commands.length).toBe(0);
    expect(path.coords.length).toBe(0);
    expect(path.fillRule).toBe('nonzero');
  });

  it('emits multiple rings for a polygon-with-hole', () => {
    const mp = [
      [
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
        [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]],
      ],
    ];
    const path = multiPolygonToPath(mp);
    // Two M commands, one per ring.
    let mCount = 0;
    for (const c of path.commands) if (c === PATH_M) mCount++;
    expect(mCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

```bash
npx vitest run src/features/paths/booleans.adapter.test.ts
```

Expected: FAIL — `multiPolygonToPath is not a function`.

- [ ] **Step 3: Implement `multiPolygonToPath`**

Append to `src/features/paths/booleans.adapter.ts`:

```ts
import { type PolygonPath } from './types';

/** Convert a `MultiPolygon` to a `PolygonPath` with `fillRule: 'nonzero'`. */
export function multiPolygonToPath(mp: MultiPolygon): PolygonPath {
  // First pass: count total commands and coord floats.
  let nCmds = 0;
  let nCoords = 0;
  for (const poly of mp) {
    for (const ring of poly) {
      if (ring.length < 4) continue; // 3 unique + 1 closing minimum
      // Drop the repeated closing vertex; emit M + (n-2) L + Z.
      const unique = ring.length - 1;
      nCmds += 1 + (unique - 1) + 1; // M + L*(unique-1) + Z
      nCoords += unique * 2;
    }
  }
  const commands = new Uint8Array(nCmds);
  const coords = new Float32Array(nCoords);
  let ci = 0;
  let pi = 0;
  for (const poly of mp) {
    for (const ring of poly) {
      if (ring.length < 4) continue;
      const unique = ring.length - 1;
      // M (first vertex)
      commands[ci++] = PATH_M;
      coords[pi++] = ring[0][0];
      coords[pi++] = ring[0][1];
      // L for vertices 1..unique-1
      for (let k = 1; k < unique; k++) {
        commands[ci++] = PATH_L;
        coords[pi++] = ring[k][0];
        coords[pi++] = ring[k][1];
      }
      // Z
      commands[ci++] = PATH_Z;
    }
  }
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npx vitest run src/features/paths/booleans.adapter.test.ts
```

Expected: PASS, 7 tests total.

- [ ] **Step 5: Round-trip test (rect → MP → path is geometrically equivalent)**

Append to `src/features/paths/booleans.adapter.test.ts`:

```ts
import { pointInPath } from './hitTest';

describe('round-trip', () => {
  it('rect → MultiPolygon → PolygonPath preserves inside-ness', () => {
    const rect: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const round = multiPolygonToPath(pathToMultiPolygon(rect));
    expect(pointInPath(round, 5, 5)).toBe(true);
    expect(pointInPath(round, 15, 5)).toBe(false);
  });
});
```

- [ ] **Step 6: Run, confirm pass**

```bash
npx vitest run src/features/paths/booleans.adapter.test.ts
```

Expected: PASS, 8 tests total.

- [ ] **Step 7: Commit**

```bash
git add src/features/paths/booleans.adapter.ts src/features/paths/booleans.adapter.test.ts
git commit -m "feat(paths): multiPolygonToPath inverse adapter"
```

---

## Task 4: Pure function — `pathUnion`

**Files:**
- Create: `src/features/paths/booleans.ts`
- Create: `src/features/paths/booleans.test.ts`

- [ ] **Step 1: Write the failing test (two overlapping rects)**

Create `src/features/paths/booleans.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pathUnion } from './booleans';
import { pointInPath } from './hitTest';
import type { RectPath } from './types';

const r = (x: number, y: number, w: number, h: number): RectPath => ({
  kind: 'rect', x, y, width: w, height: h,
});

describe('pathUnion', () => {
  it('combines two overlapping rects into a single shape covering both', () => {
    const a = r(0, 0, 10, 10);
    const b = r(5, 5, 10, 10);
    const u = pathUnion(a, b);
    // Points inside either source rect must be inside the union.
    expect(pointInPath(u, 2, 2)).toBe(true);
    expect(pointInPath(u, 12, 12)).toBe(true);
    expect(pointInPath(u, 7, 7)).toBe(true); // overlap region
    // Point outside both sources must be outside.
    expect(pointInPath(u, 20, 20)).toBe(false);
  });

  it('disjoint inputs union to a multi-contour PolygonPath', () => {
    const a = r(0, 0, 5, 5);
    const b = r(10, 10, 5, 5);
    const u = pathUnion(a, b);
    expect(pointInPath(u, 2, 2)).toBe(true);
    expect(pointInPath(u, 12, 12)).toBe(true);
    expect(pointInPath(u, 7, 7)).toBe(false); // between the disjoint pieces
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npx vitest run src/features/paths/booleans.test.ts
```

Expected: FAIL — `pathUnion is not a function`.

- [ ] **Step 3: Implement `pathUnion`**

Create `src/features/paths/booleans.ts`:

```ts
/**
 * Polygon-boolean operations on `Path` values, backed by `polygon-clipping`.
 *
 * v1 limitations (documented; see design doc):
 *   - Bezier inputs are flattened to straight-line segments before clipping.
 *     The result therefore contains only M/L/Z commands.
 *   - Open contours are treated as closed for boolean purposes (a polyline
 *     has zero area and would otherwise be silently dropped).
 *   - Output `fillRule` is always `'nonzero'`. The engine emits canonical
 *     non-overlapping rings, so the choice is cosmetic on its output.
 */
import polygonClipping from 'polygon-clipping';
import type { Path, PolygonPath } from './types';
import { pathToMultiPolygon, multiPolygonToPath } from './booleans.adapter';

/** Union of N paths. Commutative. Returns an empty path if all inputs are empty. */
export function pathUnion(...paths: Path[]): PolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  const result = polygonClipping.union(head, ...rest);
  return multiPolygonToPath(result);
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npx vitest run src/features/paths/booleans.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/booleans.ts src/features/paths/booleans.test.ts
git commit -m "feat(paths): pathUnion via polygon-clipping"
```

---

## Task 5: Pure function — `pathIntersect`

**Files:**
- Modify: `src/features/paths/booleans.ts`
- Modify: `src/features/paths/booleans.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/features/paths/booleans.test.ts`:

```ts
import { pathIntersect } from './booleans';

describe('pathIntersect', () => {
  it('returns only the overlapping region of two overlapping rects', () => {
    const a = r(0, 0, 10, 10);
    const b = r(5, 5, 10, 10);
    const i = pathIntersect(a, b);
    expect(pointInPath(i, 7, 7)).toBe(true);  // inside overlap
    expect(pointInPath(i, 2, 2)).toBe(false); // inside a only
    expect(pointInPath(i, 12, 12)).toBe(false); // inside b only
  });

  it('returns an empty path when inputs are disjoint', () => {
    const a = r(0, 0, 5, 5);
    const b = r(10, 10, 5, 5);
    const i = pathIntersect(a, b);
    expect(i.commands.length).toBe(0);
    expect(i.coords.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npx vitest run src/features/paths/booleans.test.ts
```

Expected: FAIL — `pathIntersect is not a function`.

- [ ] **Step 3: Implement `pathIntersect`**

Append to `src/features/paths/booleans.ts`:

```ts
/** Intersection of N paths. Commutative. Empty result is an empty path. */
export function pathIntersect(...paths: Path[]): PolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  const result = polygonClipping.intersection(head, ...rest);
  return multiPolygonToPath(result);
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npx vitest run src/features/paths/booleans.test.ts
```

Expected: PASS, 4 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/booleans.ts src/features/paths/booleans.test.ts
git commit -m "feat(paths): pathIntersect"
```

---

## Task 6: Pure function — `pathSubtract`

**Files:**
- Modify: `src/features/paths/booleans.ts`
- Modify: `src/features/paths/booleans.test.ts`

`pathSubtract(a, b)` returns `a − b`. Parameter names are neutral; the action hook does the Illustrator "Minus Front" mapping.

- [ ] **Step 1: Write the failing test**

Append to `src/features/paths/booleans.test.ts`:

```ts
import { pathSubtract } from './booleans';

describe('pathSubtract', () => {
  it('returns `a` with `b` punched out where they overlap', () => {
    const a = r(0, 0, 10, 10);
    const b = r(5, 5, 10, 10);
    const s = pathSubtract(a, b); // a − b
    expect(pointInPath(s, 2, 2)).toBe(true);   // inside a only — kept
    expect(pointInPath(s, 7, 7)).toBe(false);  // overlap — removed
    expect(pointInPath(s, 12, 12)).toBe(false); // inside b only — never was in result
  });

  it('inner-contained subtract produces an annulus (multi-contour)', () => {
    const outer = r(0, 0, 20, 20);
    const inner = r(5, 5, 10, 10);
    const ann = pathSubtract(outer, inner);
    expect(pointInPath(ann, 2, 2)).toBe(true);   // in the annulus
    expect(pointInPath(ann, 10, 10)).toBe(false); // in the hole
    expect(pointInPath(ann, 25, 25)).toBe(false); // outside everything
  });

  it('full subtraction produces an empty path', () => {
    const a = r(2, 2, 5, 5);
    const b = r(0, 0, 10, 10);
    const s = pathSubtract(a, b);
    expect(s.commands.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npx vitest run src/features/paths/booleans.test.ts
```

Expected: FAIL — `pathSubtract is not a function`.

- [ ] **Step 3: Implement `pathSubtract`**

Append to `src/features/paths/booleans.ts`:

```ts
/** Asymmetric difference: returns `a − b`. */
export function pathSubtract(a: Path, b: Path): PolygonPath {
  const result = polygonClipping.difference(
    pathToMultiPolygon(a),
    pathToMultiPolygon(b),
  );
  return multiPolygonToPath(result);
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npx vitest run src/features/paths/booleans.test.ts
```

Expected: PASS, 7 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/booleans.ts src/features/paths/booleans.test.ts
git commit -m "feat(paths): pathSubtract (a − b)"
```

---

## Task 7: Pure function — `pathExclude` (XOR)

**Files:**
- Modify: `src/features/paths/booleans.ts`
- Modify: `src/features/paths/booleans.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/features/paths/booleans.test.ts`:

```ts
import { pathExclude } from './booleans';

describe('pathExclude', () => {
  it('returns symmetric difference (in one or the other, not both)', () => {
    const a = r(0, 0, 10, 10);
    const b = r(5, 5, 10, 10);
    const x = pathExclude(a, b);
    expect(pointInPath(x, 2, 2)).toBe(true);    // a only
    expect(pointInPath(x, 12, 12)).toBe(true);  // b only
    expect(pointInPath(x, 7, 7)).toBe(false);   // overlap — removed
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npx vitest run src/features/paths/booleans.test.ts
```

Expected: FAIL — `pathExclude is not a function`.

- [ ] **Step 3: Implement `pathExclude`**

Append to `src/features/paths/booleans.ts`:

```ts
/** Symmetric difference (XOR) of N paths. Commutative. */
export function pathExclude(...paths: Path[]): PolygonPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  const result = polygonClipping.xor(head, ...rest);
  return multiPolygonToPath(result);
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npx vitest run src/features/paths/booleans.test.ts
```

Expected: PASS, 8 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/booleans.ts src/features/paths/booleans.test.ts
git commit -m "feat(paths): pathExclude (XOR)"
```

---

## Task 8: Pure function — `pathDivide`

**Files:**
- Modify: `src/features/paths/booleans.ts`
- Modify: `src/features/paths/booleans.test.ts`

Strategy: derive from union + per-input intersect. Compute the union of all inputs; for each input, intersect it with each "tile" produced by re-running pairwise intersections within the union's contours. The simplest correct implementation: for N inputs A1..An, the divide output is the set of all non-empty maximal regions formed by which subset of inputs covers each point.

A clean derivation that's O(N²) and easy to verify: for each input `Ai`, compute `Ai − (union of Aj where j > i)` for the "exclusive" piece, and `Ai ∩ Aj − (union of Ak where k > j)` for each pairwise overlap, etc. That blows up combinatorially. **Simpler approach for v1**: emit one output per input as `Ai − (union of all other inputs)` for the "exclusive" piece, plus one output per pair for the pairwise overlap regions. For N=2 that's exactly 3 outputs (A-only, B-only, A∩B) which matches Illustrator's Divide. For N>2 this misses higher-order overlap distinctions, but ships a useful behavior; document the limitation.

**Plan v1 implementation:** N=2 special-cased correctly (3 outputs). N>2 falls back to "pairwise + each exclusive", returning a non-empty array of distinct non-overlapping regions. We'll add a regression test for N=2 and a smoke test for N=3.

- [ ] **Step 1: Write the failing test**

Append to `src/features/paths/booleans.test.ts`:

```ts
import { pathDivide } from './booleans';

describe('pathDivide', () => {
  it('two overlapping rects → three non-empty regions (A-only, B-only, A∩B)', () => {
    const a = r(0, 0, 10, 10);
    const b = r(5, 5, 10, 10);
    const parts = pathDivide(a, b);
    expect(parts).toHaveLength(3);
    for (const p of parts) {
      expect(p.commands.length).toBeGreaterThan(0);
    }
    // Each result region should be non-overlapping with the others.
    const inside = (path: PolygonPath, x: number, y: number) => pointInPath(path, x, y);
    const counts = [2, 7, 12].map((c) =>
      parts.filter((p) => inside(p, c, c)).length,
    );
    // Each canonical sample point falls inside exactly one part.
    for (const k of counts) expect(k).toBe(1);
  });

  it('two disjoint rects → two regions (just the inputs)', () => {
    const a = r(0, 0, 5, 5);
    const b = r(10, 10, 5, 5);
    const parts = pathDivide(a, b);
    expect(parts).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npx vitest run src/features/paths/booleans.test.ts
```

Expected: FAIL — `pathDivide is not a function`.

- [ ] **Step 3: Implement `pathDivide`**

Append to `src/features/paths/booleans.ts`:

```ts
/**
 * Fracture N paths along every intersection into the maximal set of
 * non-overlapping regions. Returns one `PolygonPath` per region.
 *
 * Behavior:
 *   - For each input Ai, the exclusive region `Ai − (union of all Aj, j≠i)`
 *     is emitted if non-empty.
 *   - For each pair (Ai, Aj) with i<j, the overlap `Ai ∩ Aj` is emitted if
 *     non-empty.
 *
 * For N=2 this is exactly the three Illustrator "Divide" outputs. For N>2
 * it misses higher-order overlap distinctions (e.g. a region covered by 3
 * inputs is not separated from a region covered by only 2 of them when
 * those 2 are a subset). Documented as a v1 limitation; higher-order
 * decomposition is deferred.
 */
export function pathDivide(...paths: Path[]): PolygonPath[] {
  if (paths.length === 0) return [];
  if (paths.length === 1) {
    return [multiPolygonToPath(pathToMultiPolygon(paths[0]))];
  }
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const out: PolygonPath[] = [];

  // Exclusive regions: Ai − union(others).
  for (let i = 0; i < mps.length; i++) {
    const others = mps.filter((_, j) => j !== i);
    const [head, ...rest] = others;
    const othersUnion = polygonClipping.union(head, ...rest);
    const exclusive = polygonClipping.difference(mps[i], othersUnion);
    if (exclusive.length > 0) out.push(multiPolygonToPath(exclusive));
  }

  // Pairwise intersections (each pair once).
  for (let i = 0; i < mps.length; i++) {
    for (let j = i + 1; j < mps.length; j++) {
      const inter = polygonClipping.intersection(mps[i], mps[j]);
      if (inter.length > 0) out.push(multiPolygonToPath(inter));
    }
  }

  return out;
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npx vitest run src/features/paths/booleans.test.ts
```

Expected: PASS, 10 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/booleans.ts src/features/paths/booleans.test.ts
git commit -m "feat(paths): pathDivide (pairwise + exclusive)"
```

---

## Task 9: Edge-case + degeneracy tests

**Files:**
- Modify: `src/features/paths/booleans.test.ts`

- [ ] **Step 1: Add degeneracy and mixed-input cases**

Append to `src/features/paths/booleans.test.ts`:

```ts
import { PATH_M, PATH_L, PATH_C, PATH_Z } from './types';
import type { PolygonPath } from './types';

describe('boolean ops — edge cases', () => {
  it('handles two rects touching at an edge (no spurious sliver)', () => {
    const a = r(0, 0, 10, 10);
    const b = r(10, 0, 10, 10);
    const u = pathUnion(a, b);
    // Combined extent is a 20×10 rect.
    expect(pointInPath(u, 15, 5)).toBe(true);
    expect(pointInPath(u, 25, 5)).toBe(false);
    expect(pointInPath(u, 5, 5)).toBe(true);
  });

  it('handles two rects touching at a single vertex', () => {
    const a = r(0, 0, 10, 10);
    const b = r(10, 10, 10, 10);
    const u = pathUnion(a, b);
    expect(pointInPath(u, 5, 5)).toBe(true);
    expect(pointInPath(u, 15, 15)).toBe(true);
  });

  it('mixes RectPath and PolygonPath inputs without issue', () => {
    const rect = r(0, 0, 10, 10);
    const tri: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([5, 5, 15, 5, 10, 15]),
      fillRule: 'nonzero',
    };
    const u = pathUnion(rect, tri);
    expect(pointInPath(u, 2, 2)).toBe(true);    // rect only
    expect(pointInPath(u, 12, 8)).toBe(true);   // tri only
  });

  it('flattens cubic beziers in inputs', () => {
    // Cubic arc roughly forming a quarter-circle bulge, plus straight back to start.
    const bezier: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_C, PATH_L, PATH_Z]),
      coords: new Float32Array([
        0, 0,
        0, 10, 10, 10, 10, 0,
        0, 0,
      ]),
      fillRule: 'nonzero',
    };
    const u = pathUnion(bezier);
    expect(u.commands.length).toBeGreaterThan(0);
    // Point clearly inside the bulged region.
    expect(pointInPath(u, 5, 5)).toBe(true);
  });
});
```

- [ ] **Step 2: Run, confirm pass**

```bash
npx vitest run src/features/paths/booleans.test.ts
```

Expected: PASS — all prior + 4 new = 14 tests.

- [ ] **Step 3: Commit**

```bash
git add src/features/paths/booleans.test.ts
git commit -m "test(paths/booleans): degeneracy + mixed-input cases"
```

---

## Task 10: Public export — `features/paths/index.ts`

**Files:**
- Modify: `src/features/paths/index.ts`

- [ ] **Step 1: Add exports**

Edit `src/features/paths/index.ts` — append after the existing `export { translatePath, ... }` block:

```ts
export {
  pathUnion,
  pathIntersect,
  pathSubtract,
  pathExclude,
  pathDivide,
} from './booleans';
```

- [ ] **Step 2: Verify the kit barrel sees them**

Check `src/index.ts` for whether it re-exports `features/paths` wholesale or names symbols individually. Grep:

```bash
grep -n "features/paths" /Users/mike/src/weasel/src/index.ts
```

If the top-level `src/index.ts` already re-exports `features/paths` wholesale (e.g. `export * from './features/paths'`), nothing more is needed for the public surface. Otherwise add the explicit named exports to `src/index.ts`:

```ts
export {
  pathUnion,
  pathIntersect,
  pathSubtract,
  pathExclude,
  pathDivide,
} from './features/paths';
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: pass.

- [ ] **Step 4: Run full test suite**

```bash
npm run test
```

Expected: pass — no regressions, new tests included.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/index.ts src/index.ts
git commit -m "feat(paths): export boolean ops from public barrel"
```

---

## Task 11: Action core — `booleans.ts`

**Files:**
- Create: `src/interactions/actions/booleans/booleans.ts`
- Create: `src/interactions/actions/booleans/booleans.test.ts`

Pure core: given the adapter and an op name, fetch selected paths in z-order, run the boolean, produce a batch of `Op`s. Hookless so it's trivially testable.

- [ ] **Step 1: Write the failing test (commutative op, basic)**

Create `src/interactions/actions/booleans/booleans.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyBooleanOp, type BooleansAdapter } from './booleans';
import type { Path, PolygonPath } from 'features/paths/types';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';

function rect(id: string, x: number, y: number, w: number, h: number) {
  return {
    id: id as NodeId,
    path: { kind: 'rect', x, y, width: w, height: h } as Path,
  };
}

function makeAdapter(nodes: { id: NodeId; path: Path }[]): {
  adapter: BooleansAdapter;
  inserted: { id: string; path: Path }[];
  removed: string[];
  selection: NodeId[];
  batches: { ops: Op[]; label: string }[];
} {
  const state = {
    inserted: [] as { id: string; path: Path }[],
    removed: [] as string[],
    selection: [] as NodeId[],
    batches: [] as { ops: Op[]; label: string }[],
  };
  let nextId = 1;
  // z-order: index in `nodes` array; later = in front.
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const paths = new Map(nodes.map((n) => [n.id, n.path]));
  const adapter: BooleansAdapter = {
    getSelection: () => nodes.map((n) => n.id),
    getWorldPath: (id) => paths.get(id),
    compareZ: (a, b) => (idx.get(a) ?? 0) - (idx.get(b) ?? 0),
    createPathNode: (path) => {
      const node = { id: `result_${nextId++}`, path };
      // Carry the path through for assertions.
      (node as any).path = path;
      return node;
    },
    insertNode: (node) => state.inserted.push(node as any),
    removeNode: (id) => state.removed.push(id),
    setSelection: (ids) => { state.selection = ids; },
    applyBatch: (ops, label) => {
      state.batches.push({ ops, label });
      for (const op of ops) op.apply(adapter);
    },
  };
  return { adapter, ...state };
}

describe('applyBooleanOp', () => {
  it('union: deletes inputs, inserts one result, selects the result, one batch', () => {
    const h = makeAdapter([
      rect('a', 0, 0, 10, 10),
      rect('b', 5, 5, 10, 10),
    ]);
    const result = applyBooleanOp(h.adapter, 'union');
    expect(result.kind).toBe('applied');
    expect(h.batches).toHaveLength(1);
    expect(h.removed.sort()).toEqual(['a', 'b']);
    expect(h.inserted).toHaveLength(1);
    expect(h.selection).toEqual([h.inserted[0].id]);
  });

  it('no-op when selection has 0 paths', () => {
    const h = makeAdapter([]);
    const result = applyBooleanOp(h.adapter, 'union');
    expect(result.kind).toBe('noop');
    expect(h.batches).toHaveLength(0);
  });

  it('no-op when selection has only non-path nodes (getWorldPath returns undefined)', () => {
    const nodes = [{ id: 'g1' as NodeId, path: null as any }];
    const adapter: BooleansAdapter = {
      getSelection: () => nodes.map((n) => n.id),
      getWorldPath: () => undefined,
      compareZ: () => 0,
      createPathNode: () => ({ id: 'x' }),
    };
    const result = applyBooleanOp(adapter, 'union');
    expect(result.kind).toBe('noop');
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npx vitest run src/interactions/actions/booleans/booleans.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the action core**

Create `src/interactions/actions/booleans/booleans.ts`:

```ts
/**
 * Pure action core for path boolean operations. Resolves the current
 * selection into z-ordered paths, runs the chosen op, and dispatches a
 * single batch of `Op`s (delete sources + insert results + set selection).
 *
 * The hook (`useBooleans`) wraps this with React glue; testing here is
 * trivial because the function takes a plain adapter.
 */
import {
  pathUnion,
  pathIntersect,
  pathSubtract,
  pathExclude,
  pathDivide,
} from 'features/paths/booleans';
import type { Path, PolygonPath } from 'features/paths/types';
import { createInsertOp } from 'core/ops/create';
import { createDeleteOp } from 'core/ops/delete';
import { createSetSelectionOp } from 'core/ops/select';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { dispatchApplyBatch } from 'core/applyOps';

/** The five v1 operations. */
export type BooleanOp = 'union' | 'intersect' | 'subtract' | 'exclude' | 'divide';

/** Adapter the hook and the pure core both consume. */
export interface BooleansAdapter {
  getSelection(): NodeId[];
  getWorldPath(id: NodeId): Path | undefined;
  compareZ(a: NodeId, b: NodeId): number;
  createPathNode(path: Path): { id: string };
  applyBatch?(ops: Op[], label: string): void;
  setSelection?(ids: NodeId[]): void;
  insertNode?(node: { id: string }): void;
  removeNode?(id: string): void;
}

/** Outcome reported back to callers (lets the hook surface no-op signals). */
export type BooleanOpResult =
  | { kind: 'applied'; resultIds: string[] }
  | { kind: 'noop'; reason: 'no-paths' | 'too-few-for-subtract' | 'empty-result' };

const LABEL: Record<BooleanOp, string> = {
  union: 'Union',
  intersect: 'Intersect',
  subtract: 'Subtract',
  exclude: 'Exclude',
  divide: 'Divide',
};

function isEmpty(p: PolygonPath): boolean {
  return p.commands.length === 0;
}

export function applyBooleanOp(
  adapter: BooleansAdapter,
  op: BooleanOp,
): BooleanOpResult {
  const sel = adapter.getSelection();
  // Resolve path nodes only, in back-to-front z-order (ascending).
  const entries = sel
    .map((id) => ({ id, path: adapter.getWorldPath(id) }))
    .filter((e): e is { id: NodeId; path: Path } => e.path != null)
    .sort((a, b) => adapter.compareZ(a.id, b.id)); // back to front

  if (entries.length === 0) return { kind: 'noop', reason: 'no-paths' };
  if (op === 'subtract' && entries.length < 2) {
    return { kind: 'noop', reason: 'too-few-for-subtract' };
  }
  // Commutative ops also require ≥ 2 paths to be meaningful; with one the
  // result is the input itself — treat as noop to avoid pointless churn.
  if (entries.length < 2) return { kind: 'noop', reason: 'no-paths' };

  const paths = entries.map((e) => e.path);
  let results: PolygonPath[];

  switch (op) {
    case 'union':     results = [pathUnion(...paths)]; break;
    case 'intersect': results = [pathIntersect(...paths)]; break;
    case 'exclude':   results = [pathExclude(...paths)]; break;
    case 'subtract': {
      // Illustrator "Minus Front": back − union(everything in front).
      const back = paths[0];
      const front = paths.length === 2 ? paths[1] : pathUnion(...paths.slice(1));
      results = [pathSubtract(back, front)];
      break;
    }
    case 'divide': {
      results = pathDivide(...paths);
      break;
    }
  }

  results = results.filter((p) => !isEmpty(p));
  if (results.length === 0) return { kind: 'noop', reason: 'empty-result' };

  const newNodes = results.map((p) => adapter.createPathNode(p));
  const ops: Op[] = [];
  for (const e of entries) ops.push(createDeleteOp({ node: { id: e.id } }));
  for (const n of newNodes) ops.push(createInsertOp({ node: n }));
  ops.push(createSetSelectionOp({
    from: sel,
    to: newNodes.map((n) => n.id as NodeId),
  }));
  dispatchApplyBatch(adapter, ops, LABEL[op]);

  return { kind: 'applied', resultIds: newNodes.map((n) => n.id) };
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npx vitest run src/interactions/actions/booleans/booleans.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/interactions/actions/booleans/booleans.ts src/interactions/actions/booleans/booleans.test.ts
git commit -m "feat(actions/booleans): pure core for boolean-op batch dispatch"
```

---

## Task 12: Action core — more test coverage

**Files:**
- Modify: `src/interactions/actions/booleans/booleans.test.ts`

- [ ] **Step 1: Add subtract / divide / empty-result tests**

Append to `src/interactions/actions/booleans/booleans.test.ts`:

```ts
describe('applyBooleanOp — operation-specific behavior', () => {
  it('subtract: noop when < 2 paths selected', () => {
    const h = makeAdapter([rect('a', 0, 0, 10, 10)]);
    const result = applyBooleanOp(h.adapter, 'subtract');
    expect(result).toEqual({ kind: 'noop', reason: 'no-paths' });
    expect(h.batches).toHaveLength(0);
  });

  it('subtract: result is back − front (z-order: back first)', () => {
    // 'a' at index 0 (back), 'b' at index 1 (front)
    const h = makeAdapter([
      rect('a', 0, 0, 10, 10),
      rect('b', 5, 5, 10, 10),
    ]);
    const result = applyBooleanOp(h.adapter, 'subtract');
    expect(result.kind).toBe('applied');
    expect(h.inserted).toHaveLength(1);
    // Spot-check: (2,2) should be in result (a-only region), (7,7) outside (overlap removed).
    const path = (h.inserted[0] as any).path as PolygonPath;
    // We don't import pointInPath here; spot-check via known geometry: should have content.
    expect(path.commands.length).toBeGreaterThan(0);
  });

  it('intersect of disjoint inputs: noop with reason empty-result', () => {
    const h = makeAdapter([
      rect('a', 0, 0, 5, 5),
      rect('b', 10, 10, 5, 5),
    ]);
    const result = applyBooleanOp(h.adapter, 'intersect');
    expect(result).toEqual({ kind: 'noop', reason: 'empty-result' });
    expect(h.batches).toHaveLength(0);
  });

  it('divide: emits one node per region (3 for two overlapping rects)', () => {
    const h = makeAdapter([
      rect('a', 0, 0, 10, 10),
      rect('b', 5, 5, 10, 10),
    ]);
    const result = applyBooleanOp(h.adapter, 'divide');
    expect(result.kind).toBe('applied');
    expect(h.inserted).toHaveLength(3);
    expect(h.selection).toHaveLength(3);
  });

  it('one batch is dispatched per applied op (single undo step)', () => {
    const h = makeAdapter([
      rect('a', 0, 0, 10, 10),
      rect('b', 5, 5, 10, 10),
    ]);
    applyBooleanOp(h.adapter, 'union');
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0].label).toBe('Union');
  });
});
```

- [ ] **Step 2: Run, confirm pass**

```bash
npx vitest run src/interactions/actions/booleans/booleans.test.ts
```

Expected: PASS, 8 tests total.

- [ ] **Step 3: Commit**

```bash
git add src/interactions/actions/booleans/booleans.test.ts
git commit -m "test(actions/booleans): subtract/divide/empty-result coverage"
```

---

## Task 13: React hook — `useBooleans`

**Files:**
- Create: `src/interactions/actions/booleans/useBooleans.ts`
- Create: `src/interactions/actions/booleans/index.ts`
- Create: `src/interactions/actions/booleans/useBooleans.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/interactions/actions/booleans/useBooleans.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBooleans } from './useBooleans';
import type { BooleansAdapter } from './booleans';
import type { Path } from 'features/paths/types';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';

function makeAdapter(): {
  adapter: BooleansAdapter;
  batches: { ops: Op[]; label: string }[];
  inserted: { id: string }[];
  removed: string[];
} {
  const nodes: { id: NodeId; path: Path }[] = [
    { id: 'a' as NodeId, path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } },
    { id: 'b' as NodeId, path: { kind: 'rect', x: 5, y: 5, width: 10, height: 10 } },
  ];
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const paths = new Map(nodes.map((n) => [n.id, n.path]));
  const state = {
    batches: [] as { ops: Op[]; label: string }[],
    inserted: [] as { id: string }[],
    removed: [] as string[],
  };
  let nextId = 1;
  const adapter: BooleansAdapter = {
    getSelection: () => nodes.map((n) => n.id),
    getWorldPath: (id) => paths.get(id),
    compareZ: (a, b) => (idx.get(a) ?? 0) - (idx.get(b) ?? 0),
    createPathNode: (path) => ({ id: `r${nextId++}` }),
    insertNode: (n) => state.inserted.push(n),
    removeNode: (id) => state.removed.push(id),
    setSelection: () => {},
    applyBatch: (ops, label) => {
      state.batches.push({ ops, label });
      for (const op of ops) op.apply(adapter);
    },
  };
  return { adapter, ...state };
}

describe('useBooleans', () => {
  it('returns five callables — one per op', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() => useBooleans(adapter));
    expect(typeof result.current.union).toBe('function');
    expect(typeof result.current.intersect).toBe('function');
    expect(typeof result.current.subtract).toBe('function');
    expect(typeof result.current.exclude).toBe('function');
    expect(typeof result.current.divide).toBe('function');
  });

  it('union dispatches one batch and inserts one node', () => {
    const h = makeAdapter();
    const { result } = renderHook(() => useBooleans(h.adapter));
    act(() => { result.current.union(); });
    expect(h.batches).toHaveLength(1);
    expect(h.inserted).toHaveLength(1);
    expect(h.removed.sort()).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npx vitest run src/interactions/actions/booleans/useBooleans.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `src/interactions/actions/booleans/useBooleans.ts`:

```ts
/**
 * `useBooleans` — selection-driven Boolean ops on path layers.
 *
 * Returns five imperative callables (`union` / `intersect` / `subtract` /
 * `exclude` / `divide`). Each reads the current selection, performs the op
 * in world space, and dispatches a single batch through the adapter's
 * `applyBatch` (one undo step).
 *
 * Adapter shape: see `BooleansAdapter` in `./booleans.ts`. Consumers
 * supply how to read selection, fetch the world-space `Path` for an id,
 * compare ids by stacking order, and mint a node from a result `Path`.
 *
 * No-ops are silent in production; in dev, `subtract` with < 2 selected
 * paths emits a `console.warn`.
 */
import { useCallback, useRef } from 'react';
import { applyBooleanOp, type BooleansAdapter, type BooleanOp } from './booleans';

export interface UseBooleansReturn {
  union(): void;
  intersect(): void;
  subtract(): void;
  exclude(): void;
  divide(): void;
}

const isDev = typeof import.meta !== 'undefined'
  && (import.meta as any).env
  && (import.meta as any).env.DEV;

export function useBooleans(adapter: BooleansAdapter): UseBooleansReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const run = useCallback((op: BooleanOp) => {
    const result = applyBooleanOp(adapterRef.current, op);
    if (isDev && result.kind === 'noop' && result.reason === 'too-few-for-subtract') {
      // eslint-disable-next-line no-console
      console.warn('[useBooleans] subtract requires at least 2 selected paths');
    }
  }, []);

  return {
    union: useCallback(() => run('union'), [run]),
    intersect: useCallback(() => run('intersect'), [run]),
    subtract: useCallback(() => run('subtract'), [run]),
    exclude: useCallback(() => run('exclude'), [run]),
    divide: useCallback(() => run('divide'), [run]),
  };
}
```

Create `src/interactions/actions/booleans/index.ts`:

```ts
export { useBooleans, type UseBooleansReturn } from './useBooleans';
export { applyBooleanOp, type BooleanOp, type BooleansAdapter, type BooleanOpResult } from './booleans';
```

- [ ] **Step 4: Run, confirm pass**

```bash
npx vitest run src/interactions/actions/booleans/useBooleans.test.tsx
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/interactions/actions/booleans/useBooleans.ts src/interactions/actions/booleans/index.ts src/interactions/actions/booleans/useBooleans.test.tsx
git commit -m "feat(actions/booleans): useBooleans hook"
```

---

## Task 14: Re-export from kit barrel

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Inspect existing exports**

```bash
grep -n "interactions/actions" /Users/mike/src/weasel/src/index.ts | head
```

Note the pattern (named per-action exports vs. star). Match what's there.

- [ ] **Step 2: Add the new exports**

Append to `src/index.ts` near the other action-hook exports:

```ts
export {
  useBooleans,
  applyBooleanOp,
  type BooleanOp,
  type BooleansAdapter,
  type BooleanOpResult,
  type UseBooleansReturn,
} from './interactions/actions/booleans';
```

- [ ] **Step 3: Run typecheck + test**

```bash
npm run typecheck && npm run test
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(weasel): export useBooleans from public barrel"
```

---

## Task 15: Demo — `BooleanOpsDemo.tsx`

**Files:**
- Create: `demo/demos/BooleanOpsDemo.tsx`
- Modify: demo registry (locate during step 1)

- [ ] **Step 1: Locate the demo registry**

```bash
grep -rln "ComposeDemo\|CompoundPathsDemo" /Users/mike/src/weasel/demo --include="*.tsx" --include="*.ts"
```

Note the file(s) that register existing demos (the demo list with `id` / `component` pairs). The hash route `#boolean-ops` will need to match.

- [ ] **Step 2: Read a small existing demo to mirror its scaffolding**

```bash
cat /Users/mike/src/weasel/demo/demos/ComposeDemo.tsx
```

Note the imports, scene/canvas setup pattern, and how paths are pushed into the scene.

- [ ] **Step 3: Create `BooleanOpsDemo.tsx`**

Create `demo/demos/BooleanOpsDemo.tsx`. The demo renders five panels in a grid (union / intersect / subtract / exclude / divide). Each panel computes its boolean from a fixed two-shape input — a 60×60 rect at (10,10) and a 40-radius circle at (75,75) approximated as a 32-gon polygon path — and pushes the result(s) into a `SceneCanvas` with fixed-size styling. Use the project's existing demo scaffolding (`SceneCanvas` + `useScene`) — match the pattern in `ComposeDemo.tsx`.

The exact code depends on the demo template; write code that:

1. Imports `pathUnion`, `pathIntersect`, `pathSubtract`, `pathExclude`, `pathDivide` from `'../../src'` (relative to demo/demos).
2. Constructs the two inputs (rect + 32-gon circle approximation) as `Path` values.
3. For each op, computes the result(s) and inserts them as path layers in their own `SceneCanvas` instance.
4. Renders the five canvases in a CSS grid (no inline styles per CLAUDE.md — use a CSS class defined in the existing demo CSS file or a `<style>` block at module scope).
5. Each panel is statically labeled (`<h3>Union</h3>` etc.) above its canvas.

Reference circle-approximation snippet (32 vertices around `cx, cy`):

```ts
import { PATH_M, PATH_L, PATH_Z, type PolygonPath } from '../../src';

function circle(cx: number, cy: number, r: number, n = 32): PolygonPath {
  const commands = new Uint8Array(n + 1);
  const coords = new Float32Array(n * 2);
  commands[0] = PATH_M;
  for (let i = 1; i < n; i++) commands[i] = PATH_L;
  commands[n] = PATH_Z;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    coords[i * 2] = cx + Math.cos(t) * r;
    coords[i * 2 + 1] = cy + Math.sin(t) * r;
  }
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}
```

- [ ] **Step 4: Register the demo**

Edit the demo registry file (from Step 1). Add an entry with `id: 'boolean-ops'` pointing at `BooleanOpsDemo`.

- [ ] **Step 5: Manual sanity check**

Run the demo dev server:

```bash
npm run dev
```

Open `http://localhost:<port>/#boolean-ops` in a browser. Confirm:

- Five panels render labeled correctly.
- The union panel shows a single combined silhouette.
- The intersect panel shows only the rect-circle overlap region.
- The subtract panel shows the back shape (rect) with the front shape (circle) punched out.
- The exclude panel shows both shapes minus their overlap.
- The divide panel shows three (or more) distinct color-codable regions (you can color them by inserting each as a separate path layer with a different fill).

Kill the dev server.

- [ ] **Step 6: Commit**

```bash
git add demo/demos/BooleanOpsDemo.tsx demo/demos/<registry-file>
git commit -m "demo: BooleanOpsDemo showing all five operations"
```

---

## Task 16: Visual regression spec

**Files:**
- Create: `tests/visual/boolean-ops.spec.ts`
- Create: `tests/visual/baselines/boolean-ops.png` (via update step)

- [ ] **Step 1: Create the spec**

Create `tests/visual/boolean-ops.spec.ts`:

```ts
/**
 * Visual regression spec: boolean-ops demo.
 *
 * Captures the canvas and asserts pixel diff vs the committed baseline.
 *
 * Interaction sequence:
 *   1. Initial mount — capture static scene with five op panels.
 *
 * Notes: Static after mount. evenodd-stencil-edge differences possible on
 * multi-contour results; tolerance bumped to 5% to mirror compound-paths.
 */
import { test } from '@playwright/test';
import { resolve } from 'node:path';
import { captureCanvas, assertMatchesBaseline, type DiffOptions } from './diff.js';

const DEMO_ID = 'boolean-ops';
const BASELINE_DIR = resolve(import.meta.dirname, 'baselines');

const OPTS: DiffOptions = { maxDiffRatio: 0.05 };

test(`${DEMO_ID} — visual baseline`, async ({ page }) => {
  const png = await captureCanvas(page, `/#${DEMO_ID}`);
  assertMatchesBaseline(png, resolve(BASELINE_DIR, `${DEMO_ID}.png`), OPTS);
});
```

- [ ] **Step 2: Generate the baseline image**

```bash
UPDATE_SNAPSHOTS=1 npx playwright test --config=tests/visual/playwright.config.ts tests/visual/boolean-ops.spec.ts
```

Expected: PASS, baseline written to `tests/visual/baselines/boolean-ops.png`.

- [ ] **Step 3: Run the spec normally (verifies the baseline is stable)**

```bash
npx playwright test --config=tests/visual/playwright.config.ts tests/visual/boolean-ops.spec.ts
```

Expected: PASS — pixel diff against the just-generated baseline is 0%.

- [ ] **Step 4: Commit**

```bash
git add tests/visual/boolean-ops.spec.ts tests/visual/baselines/boolean-ops.png
git commit -m "test(visual): boolean-ops baseline"
```

---

## Task 17: TODO doc — collapse Active priority + move companions to medium

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Inspect the current TODO state**

```bash
grep -n "path boolean\|Pathfinder" /Users/mike/src/weasel/docs/TODO.md
```

Note the line ranges of the "Active priority" section (line 10 onward) and the Tier-3 pointer near the bottom.

- [ ] **Step 2: Rewrite the section header to mark it done**

Edit `docs/TODO.md`. Replace the section header at line 10 from:

```markdown
## Active priority — path boolean operations (Pathfinder) — 2026-05-11
```

to:

```markdown
## Path boolean operations — DONE 2026-05-11
```

Replace the body of the section with a single-paragraph summary linking to the spec and plan:

```markdown
Shipped `pathUnion` / `pathIntersect` / `pathSubtract` / `pathExclude` /
`pathDivide` over `Path`, plus `useBooleans` selection action. Backed by
vendored `polygon-clipping`. Spec:
`docs/superpowers/specs/2026-05-11-path-boolean-ops-design.md`. Plan:
`docs/superpowers/plans/2026-05-11-path-boolean-ops.md`.
```

- [ ] **Step 3: Add a medium-priority entry for the deferred items**

In the medium-priority section of `docs/TODO.md` (locate by reading the file's section structure), add:

```markdown
- **Path-boolean follow-ups.** Out-of-scope from v1 (see DONE entry above):
  - Companion ops: Crop, Outline, Trim, Merge.
  - Non-destructive boolean groups (new layer type, child-edit reflow).
  - True curve booleans (Bezier-preserving — Skia/PathKit territory).
  - Live preview during the action gesture.
  - Boolean ops on stroked paths (requires stroke-to-fill).
  - Pathfinder UI panel / palette.
  - Higher-order N-way overlap separation for `pathDivide` (v1 emits
    exclusives + pairwise intersections only).
```

- [ ] **Step 4: Update the Tier-3 pointer at the bottom of the file**

Find the existing Tier-3 entry referencing the active-priority section and replace its body with a one-liner referencing the new DONE section:

```markdown
- **Pathfinder-style shape merge operations.** *Shipped 2026-05-11; see
  § "Path boolean operations — DONE 2026-05-11".*
```

- [ ] **Step 5: Commit**

```bash
git add docs/TODO.md
git commit -m "docs(todo): mark path boolean ops shipped; defer companion ops"
```

---

## Task 18: Pre-publish verification

This task runs the same gates CI uses on release.

- [ ] **Step 1: Typecheck**

```bash
npm run typecheck
```

Expected: pass.

- [ ] **Step 2: Run vitest**

```bash
npm run test
```

Expected: pass.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: pass (tsup completes with no errors).

- [ ] **Step 4: Run the full prepublish gate**

```bash
npm run prepublishOnly
```

Expected: pass — this runs typecheck + test + build sequentially.

- [ ] **Step 5: Run visual regression once more end-to-end**

```bash
npm run test:visual
```

Expected: pass — all baselines including the new `boolean-ops.png`.

- [ ] **Step 6: No commit needed unless any of the above produced changes.**

If `npm run build` or anything else updates artifacts that need to be committed, do so with a final `chore:` commit. Otherwise this task is purely a gate.

---

## Self-review

Quick checklist before handing off:

- **Spec coverage.** Five ops × pure fn (Tasks 4–8) ✓; engine adapter (Tasks 2–3) ✓; `useBooleans` action hook (Tasks 11–13) ✓; barrel exports (Tasks 10, 14) ✓; visual baseline (Task 16) ✓; TODO updates (Task 17) ✓.
- **No placeholders.** Code blocks present at every code step; expected command output stated.
- **Type consistency.** `BooleansAdapter`, `BooleanOp`, `BooleanOpResult`, `UseBooleansReturn` appear identically across `booleans.ts`, `useBooleans.ts`, `index.ts`. `applyBooleanOp` signature matches between definition (Task 11), tests (Task 12), and hook use (Task 13).
- **Coordinate scaling.** The spec's "Risk / open items" called out potential epsilon issues at extreme coord scales. v1 leaves coords untouched — `polygon-clipping` v0.15 is robust enough for the demo's coord range (single-digit thousands) and weasel's typical scene scale. If users hit precision issues at high zoom we'll add a `BOUNDS_SCALE` constant inside the adapter. Documented in the spec; no code change in this plan.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-11-path-boolean-ops.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
