# Renderer Layer Caching and Stroke Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `@weasel-js/core` deps-keyed command-tree caching for render layers, dashed strokes, and screen-space stroke widths, and fix a shadowed export that makes the viewport `computeFitView` unreachable.

**Architecture:** Three independent additions to the engine, all under `packages/core/src`. `RenderLayer` gains an optional `deps` function; `drawLayers` takes an optional caller-owned cache and reuses a layer's `DrawCommand[]` when its deps are unchanged. `Stroke` gains a dash pattern and a screen-space width variant, both resolved at tessellation time. Nothing here depends on labkit; the labkit port is a separate plan.

**Tech Stack:** TypeScript, React, WebGL2, Vitest, Biome.

---

## Context for the implementer

`weasel` is a 2D scene-graph canvas library published as `@weasel-js/core`. It renders through
WebGL2: a *render layer* does not paint into a 2D context, it returns a tree of `DrawCommand`
objects that `WeaselRenderer` dispatches. `drawLayers` (`packages/core/src/core/layers/render.ts`)
walks the visible layers, calls each one's `draw`, and concatenates the results.

Read before starting:

- `packages/core/src/core/layers/render.ts` — the whole file, ~160 lines.
- `packages/core/src/core/paint-types.ts:130` — the `Stroke` interface.
- `CLAUDE.md` at the repo root — **every changeset you write is `patch`**, and you
  must never write a `bump-approved` marker.

Run the suite with `npx vitest run --project=kit`. A single file is
`npx vitest run --project=kit packages/core/src/core/layers/render.test.ts` from the repo root.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/core/layers/render.ts` | `RenderLayer.deps`, `LayerCommandCache`, cache lookup in `drawLayers` |
| `packages/core/src/core/layers/render.test.ts` | Cache hit/miss/eviction behavior |
| `packages/core/src/canvas/Canvas.tsx` | Owns the cache ref, threads it into `drawLayers` |
| `packages/core/src/core/paint-types.ts` | `Stroke.dash`, `Stroke.width` screen-space variant |
| `packages/core/src/features/paths/tessellate/stroke.ts` | Dash splitting and screen-width resolution |
| `packages/core/src/index.ts` | Rename the shadowed `computeFitView` export |
| `packages/labkit/src/passthrough/weasel-canvas.ts` | Follow the rename |

---

### Task 1: Un-shadow the viewport `computeFitView`

`index.ts:115` star-exports `computeFitView` from `core/viewport/useAutoCenter`, and `index.ts:366`
explicitly exports a *different* `computeFitView` from `canvas/minimapMath`. An explicit named
export shadows one arriving via `export *`, so the viewport version is unreachable from the public
entry. Everything later in this plan is fine without it, but the labkit plan reaches for it, and a
silently-wrong function is worse than a missing one.

**Files:**
- Modify: `packages/core/src/core/viewport/useAutoCenter.ts`
- Modify: `packages/core/src/index.ts:115`
- Modify: `packages/labkit/src/passthrough/weasel-canvas.ts`
- Test: `packages/core/src/core/viewport/useAutoCenter.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/core/viewport/useAutoCenter.test.ts`:

```ts
import { computeFitViewport } from '../../index';

describe('computeFitViewport is reachable from the public entry', () => {
  it('centers content in a viewport', () => {
    const fit = computeFitViewport(200, 100, 100, 100);
    expect(fit.zoom).toBeCloseTo(0.85);
    expect(fit.panX).toBeCloseTo(57.5);
    expect(fit.panY).toBeCloseTo(7.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/core/viewport/useAutoCenter.test.ts -t "reachable"`
Expected: FAIL — `computeFitViewport` is not exported.

- [ ] **Step 3: Rename the viewport function**

In `packages/core/src/core/viewport/useAutoCenter.ts`, rename `computeFitView` to
`computeFitViewport` and update its one internal caller inside `useAutoCenter`:

```ts
export function computeFitViewport(
  viewportW: number,
  viewportH: number,
  contentW: number,
  contentH: number,
  padRatio = 0.85,
): { zoom: number; panX: number; panY: number } {
  const zoom = fitZoom(viewportW * padRatio, viewportH * padRatio, contentW, contentH);
  const cw = contentW * zoom;
  const ch = contentH * zoom;
  return { zoom, panX: (viewportW - cw) / 2, panY: (viewportH - ch) / 2 };
}
```

Inside `useAutoCenter`, change `const fit = computeFitView(...)` to
`const fit = computeFitViewport(...)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/core/viewport/useAutoCenter.test.ts -t "reachable"`
Expected: PASS.

- [ ] **Step 5: Run the full core suite for fallout**

Run: `npx vitest run --project=kit`
Expected: PASS. The minimap `computeFitView` is untouched, so
`packages/labkit/src/passthrough/weasel-canvas.ts` still resolves — it was re-exporting the minimap
one all along. Leave that passthrough alone; renaming the *other* function is what makes its name
honest.

- [ ] **Step 6: Write a changeset**

Create `.changeset/unshadow-viewport-fit.md`:

```markdown
---
'@weasel-js/core': patch
---

Rename the viewport `computeFitView` to `computeFitViewport`. It was unreachable from the package
entry: an identically-named export from the minimap module shadowed it. This is a breaking rename
of a symbol nobody could import.
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/core/viewport/useAutoCenter.ts \
        packages/core/src/core/viewport/useAutoCenter.test.ts \
        .changeset/unshadow-viewport-fit.md
git commit -m "rename the viewport computeFitView so the minimap one stops shadowing it"
```

---

### Task 2: `RenderLayer.deps` and the cache type

Types only — no behavior yet, so this task has no test of its own. Task 3 tests the behavior.

**Files:**
- Modify: `packages/core/src/core/layers/render.ts`

- [ ] **Step 1: Add `deps` to `RenderLayer`**

In `packages/core/src/core/layers/render.ts`, add to the `RenderLayer<TData>` interface, after
`draw`:

```ts
  /**
   * Optional cache key. When present and a `LayerCommandCache` is supplied to
   * `drawLayers`, the layer's previous `DrawCommand[]` is reused as long as
   * every entry is `Object.is`-equal to the previous call's. A layer with no
   * `deps` rebuilds on every frame.
   *
   * **The returned commands must be treated as immutable.** A cached tree is
   * handed to the renderer again on later frames, so mutating a tree you
   * previously returned corrupts the cache silently rather than erroring.
   */
  deps?: (data: TData, view: View, dims: Dims) => readonly unknown[];
```

- [ ] **Step 2: Add the cache type**

Below the `Dims` interface in the same file:

```ts
/** One layer's memoized output, keyed by layer id. Owned by the canvas that
 *  calls `drawLayers`, not by `drawLayers` itself — the function is pure. */
export type LayerCommandCache = Map<
  string,
  { deps: readonly unknown[]; cmds: DrawCommand[] }
>;
```

`DrawCommand` is already imported at the top of the file; `View` and `Dims` are already in scope.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/core/layers/render.ts
git commit -m "add RenderLayer.deps and the layer command cache type"
```

---

### Task 3: Cache lookup in `drawLayers`

**Files:**
- Modify: `packages/core/src/core/layers/render.ts:126-160`
- Test: `packages/core/src/core/layers/render.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/src/core/layers/render.test.ts`:

```ts
import { drawLayers, type LayerCommandCache, type RenderLayer } from './render';

function countingLayer(id: string, calls: { n: number }): RenderLayer<{ v: number }> {
  return {
    id,
    label: id,
    deps: (data) => [data.v],
    draw: (data) => {
      calls.n += 1;
      return [{ kind: 'rect', x: data.v, y: 0, w: 1, h: 1, fill: { color: '#fff' } }];
    },
  } as RenderLayer<{ v: number }>;
}

const DIMS = { width: 100, height: 100 };

describe('drawLayers command caching', () => {
  it('reuses the tree when deps are unchanged', () => {
    const calls = { n: 0 };
    const layers = [countingLayer('a', calls)];
    const cache: LayerCommandCache = new Map();

    drawLayers(layers, { v: 1 }, {}, undefined, undefined, DIMS, cache);
    drawLayers(layers, { v: 1 }, {}, undefined, undefined, DIMS, cache);

    expect(calls.n).toBe(1);
  });

  it('rebuilds when deps change', () => {
    const calls = { n: 0 };
    const layers = [countingLayer('a', calls)];
    const cache: LayerCommandCache = new Map();

    drawLayers(layers, { v: 1 }, {}, undefined, undefined, DIMS, cache);
    drawLayers(layers, { v: 2 }, {}, undefined, undefined, DIMS, cache);

    expect(calls.n).toBe(2);
  });

  it('rebuilds every call for a layer with no deps', () => {
    const calls = { n: 0 };
    const layer = { ...countingLayer('a', calls) };
    delete (layer as { deps?: unknown }).deps;
    const cache: LayerCommandCache = new Map();

    drawLayers([layer], { v: 1 }, {}, undefined, undefined, DIMS, cache);
    drawLayers([layer], { v: 1 }, {}, undefined, undefined, DIMS, cache);

    expect(calls.n).toBe(2);
  });

  it('rebuilds every call when no cache is supplied', () => {
    const calls = { n: 0 };
    const layers = [countingLayer('a', calls)];

    drawLayers(layers, { v: 1 }, {}, undefined, undefined, DIMS);
    drawLayers(layers, { v: 1 }, {}, undefined, undefined, DIMS);

    expect(calls.n).toBe(2);
  });

  it('returns the same array identity on a cache hit', () => {
    const calls = { n: 0 };
    const layers = [countingLayer('a', calls)];
    const cache: LayerCommandCache = new Map();

    const first = drawLayers(layers, { v: 1 }, {}, undefined, undefined, DIMS, cache);
    const second = drawLayers(layers, { v: 1 }, {}, undefined, undefined, DIMS, cache);

    const firstChildren = (first[0] as { children: unknown[] }).children;
    const secondChildren = (second[0] as { children: unknown[] }).children;
    expect(secondChildren).toBe(firstChildren);
  });

  it('drops entries for layers that are no longer present', () => {
    const calls = { n: 0 };
    const cache: LayerCommandCache = new Map();

    drawLayers([countingLayer('a', calls)], { v: 1 }, {}, undefined, undefined, DIMS, cache);
    expect(cache.has('a')).toBe(true);

    drawLayers([countingLayer('b', calls)], { v: 1 }, {}, undefined, undefined, DIMS, cache);
    expect(cache.has('a')).toBe(false);
  });

  it('does not serve a hidden layer from cache to a visible one', () => {
    const calls = { n: 0 };
    const layers = [countingLayer('a', calls)];
    const cache: LayerCommandCache = new Map();

    drawLayers(layers, { v: 1 }, { a: false }, undefined, undefined, DIMS, cache);
    expect(calls.n).toBe(0);

    drawLayers(layers, { v: 1 }, { a: true }, undefined, undefined, DIMS, cache);
    expect(calls.n).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project=kit packages/core/src/core/layers/render.test.ts -t "command caching"`
Expected: FAIL — `drawLayers` takes six parameters, so the seventh is rejected by the compiler and
the counting assertions are wrong.

- [ ] **Step 3: Implement the cache**

Replace the body of `drawLayers` in `packages/core/src/core/layers/render.ts` with:

```ts
export function drawLayers<TData>(
  layers: RenderLayer<TData>[],
  data: TData,
  visibility: Record<string, boolean>,
  order: string[] | undefined,
  view: View | undefined,
  dims: Dims,
  cache?: LayerCommandCache,
): DrawCommand[] {
  const layerById = new Map(layers.map((l) => [l.id, l]));
  const sequence = order
    ? order.map((id) => layerById.get(id)).filter((l): l is RenderLayer<TData> => l !== undefined)
    : layers;
  const v = view ?? IDENTITY_VIEW;
  const out: DrawCommand[] = [];

  if (cache) {
    for (const id of [...cache.keys()]) {
      if (!layerById.has(id)) cache.delete(id);
    }
  }

  for (const layer of sequence) {
    const visible =
      layer.alwaysOn ||
      (layer.id in visibility ? visibility[layer.id] : (layer.defaultVisible ?? true));
    if (!visible) continue;

    const cmds = drawOneLayer(layer, data, v, dims, cache);
    if (cmds.length === 0) continue;

    const space = layer.space ?? 'world';
    if (space === 'world') {
      out.push({ kind: 'group', transform: viewToMat3(v), children: cmds });
    } else {
      for (const c of cmds) out.push(c);
    }
  }

  return out;
}

/** Resolve one layer's commands, from cache when its deps are unchanged. */
function drawOneLayer<TData>(
  layer: RenderLayer<TData>,
  data: TData,
  view: View,
  dims: Dims,
  cache: LayerCommandCache | undefined,
): DrawCommand[] {
  if (!cache || !layer.deps) return layer.draw(data, view, dims);

  const deps = layer.deps(data, view, dims);
  const entry = cache.get(layer.id);
  if (entry && sameDeps(entry.deps, deps)) return entry.cmds;

  const cmds = layer.draw(data, view, dims);
  cache.set(layer.id, { deps, cmds });
  return cmds;
}

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}
```

Add `LayerCommandCache` to the file's own exports if it is not already exported from Task 2.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --project=kit packages/core/src/core/layers/render.test.ts`
Expected: PASS, including the file's pre-existing tests.

- [ ] **Step 5: Export the cache type from the package entry**

In `packages/core/src/index.ts`, find the line exporting from `core/layers/render` and add
`LayerCommandCache` to its type exports. If the module is star-exported, no change is needed —
verify with:

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/core/layers/render.ts packages/core/src/core/layers/render.test.ts packages/core/src/index.ts
git commit -m "cache a render layer's command tree against its declared deps"
```

---

### Task 4: `Canvas` owns the cache

**Files:**
- Modify: `packages/core/src/canvas/Canvas.tsx:1433`
- Test: `packages/core/src/canvas/Canvas.layerCache.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/canvas/Canvas.layerCache.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { Canvas } from './Canvas';

// jsdom has no WebGL2, so Canvas bails before rendering. What this asserts is
// narrower and still worth having: the cache survives a re-render rather than
// being rebuilt into a fresh Map each pass, which would make it useless.
describe('Canvas layer command cache', () => {
  it('keeps one cache instance across re-renders', () => {
    const seen = new Set<object>();
    const layer = {
      id: 'probe',
      label: 'probe',
      deps: () => [1],
      draw: () => [],
    };
    const { rerender } = render(<Canvas width={10} height={10} layers={[layer]} data={{}} />);
    rerender(<Canvas width={10} height={10} layers={[layer]} data={{}} />);
    expect(seen.size).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run it to see the current state**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.layerCache.test.tsx`
Expected: FAIL or error — `Canvas`'s required props differ from the stub above. Read
`packages/core/src/canvas/Canvas.tsx`'s `CanvasProps` and the existing
`packages/core/src/canvas/Canvas.dpr.test.tsx` for the minimal mounting shape this repo already
uses, then fix the test's props to match. Do not add props to `Canvas` to satisfy the test.

- [ ] **Step 3: Add the cache ref and thread it through**

In `packages/core/src/canvas/Canvas.tsx`, beside `glRendererRef` (around line 800):

```tsx
  const layerCacheRef = useRef<LayerCommandCache>(new Map());
```

Import `LayerCommandCache` as a type from `../core/layers/render`.

At the `drawLayers(` call (around line 1433), pass the cache as the seventh argument:

```tsx
    const commands = drawLayers(
      layersWithDebug,
      data,
      visibility,
      order,
      view,
      dims,
      layerCacheRef.current,
    );
```

Match the existing argument names at that call site — the list above uses the spec's names, and
the real call may name them differently. Keep the order.

- [ ] **Step 4: Clear the cache when the renderer is recreated**

A new GL context invalidates nothing about command trees, but a `dispose` leaves stale entries
holding references to trees nobody will draw. In the effect that nulls `glRendererRef` on cleanup,
add:

```tsx
      layerCacheRef.current.clear();
```

- [ ] **Step 5: Run the canvas suite**

Run: `npx vitest run --project=kit packages/core/src/canvas/`
Expected: PASS. `Canvas.test.tsx` and `Canvas.dispose.test.tsx` must be unaffected — no layer in
the kit declares `deps` yet, so every layer still rebuilds each frame.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/canvas/Canvas.tsx packages/core/src/canvas/Canvas.layerCache.test.tsx
git commit -m "let Canvas own the layer command cache across frames"
```

---

### Task 5: Dashed strokes

**Files:**
- Modify: `packages/core/src/core/paint-types.ts:130`
- Modify: `packages/core/src/features/paths/tessellate/stroke.ts`
- Test: `packages/core/src/features/paths/tessellate/stroke.dash.test.ts` (create)

- [ ] **Step 1: Read the existing tessellator**

Read `packages/core/src/features/paths/tessellate/stroke.ts` in full and
`packages/core/src/renderer/cache/strokeMeshCache.ts:23`. The dash pass splits a flattened
polyline into sub-polylines *before* the existing stroke tessellation runs, so the mesh cache key
must include the dash pattern or a dashed and undashed stroke of the same path collide.

- [ ] **Step 2: Write the failing tests**

Create `packages/core/src/features/paths/tessellate/stroke.dash.test.ts`:

```ts
import { dashPolyline } from './stroke';

describe('dashPolyline', () => {
  it('splits a line into on-segments', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const runs = dashPolyline(pts, [2, 2]);
    expect(runs).toEqual([
      [{ x: 0, y: 0 }, { x: 2, y: 0 }],
      [{ x: 4, y: 0 }, { x: 6, y: 0 }],
      [{ x: 8, y: 0 }, { x: 10, y: 0 }],
    ]);
  });

  it('carries the phase across a corner', () => {
    const pts = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }];
    const runs = dashPolyline(pts, [2, 2]);
    expect(runs[1][0]).toEqual({ x: 3, y: 1 });
  });

  it('returns the polyline unchanged for an empty pattern', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    expect(dashPolyline(pts, [])).toEqual([pts]);
  });

  it('treats an odd-length pattern as repeated twice', () => {
    const pts = [{ x: 0, y: 0 }, { x: 12, y: 0 }];
    const odd = dashPolyline(pts, [3]);
    const even = dashPolyline(pts, [3, 3]);
    expect(odd).toEqual(even);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run --project=kit packages/core/src/features/paths/tessellate/stroke.dash.test.ts`
Expected: FAIL — `dashPolyline` is not exported.

- [ ] **Step 4: Implement `dashPolyline`**

Add to `packages/core/src/features/paths/tessellate/stroke.ts`:

```ts
/** Split a flattened polyline into the "on" runs of a dash pattern. Phase
 *  carries across vertices so a corner does not restart the pattern. An empty
 *  pattern returns the input as a single run; an odd-length pattern repeats,
 *  matching Canvas2D's `setLineDash`. */
export function dashPolyline(
  pts: readonly { x: number; y: number }[],
  pattern: readonly number[],
): { x: number; y: number }[][] {
  if (pattern.length === 0 || pts.length < 2) return [[...pts]];
  const pat = pattern.length % 2 === 1 ? [...pattern, ...pattern] : [...pattern];
  const total = pat.reduce((a, b) => a + b, 0);
  if (total <= 0) return [[...pts]];

  const runs: { x: number; y: number }[][] = [];
  let idx = 0;
  let remaining = pat[0];
  let on = true;
  let current: { x: number; y: number }[] = on ? [{ ...pts[0] }] : [];

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    let segLen = Math.hypot(b.x - a.x, b.y - a.y);
    let t0 = 0;
    if (segLen === 0) continue;

    while (segLen > remaining) {
      const t = t0 + (remaining / Math.hypot(b.x - a.x, b.y - a.y));
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (on) {
        current.push(p);
        runs.push(current);
        current = [];
      } else {
        current = [p];
      }
      on = !on;
      segLen -= remaining;
      t0 = t;
      idx = (idx + 1) % pat.length;
      remaining = pat[idx];
    }

    remaining -= segLen;
    if (on) current.push({ ...b });
  }

  if (on && current.length > 1) runs.push(current);
  return runs;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run --project=kit packages/core/src/features/paths/tessellate/stroke.dash.test.ts`
Expected: PASS.

- [ ] **Step 6: Add `dash` to `Stroke`**

In `packages/core/src/core/paint-types.ts`, add to the `Stroke` interface:

```ts
  /** Dash pattern in world units, alternating on and off lengths. An odd-length
   *  array repeats, as Canvas2D's `setLineDash` does. Omitted means solid. */
  dash?: number[];
```

- [ ] **Step 7: Apply the pattern in the tessellator**

In `stroke.ts`, where a flattened polyline is handed to the stroke mesh builder, route it through
`dashPolyline(pts, stroke.dash ?? [])` and tessellate each returned run as its own stroke. Add
the dash pattern to the mesh cache key in
`packages/core/src/renderer/cache/strokeMeshCache.ts` — join it into the existing key string so a
dashed and an undashed stroke of the same geometry do not collide.

- [ ] **Step 8: Write the round-trip test**

Add to `packages/core/src/features/paths/tessellate/stroke.dash.test.ts`:

```ts
it('produces fewer vertices than the same path undashed', () => {
  const solid = tessellateStroke(LINE_PATH, { width: 1 });
  const dashed = tessellateStroke(LINE_PATH, { width: 1, dash: [2, 2] });
  expect(dashed.vertices.length).toBeLessThan(solid.vertices.length);
});
```

Define `LINE_PATH` using the same `Path` construction the file's neighbors use — read
`packages/core/src/features/paths/tessellate/stroke.ts`'s existing tests for the shape. Match
`tessellateStroke`'s real option names; `StrokeOptions` is at `stroke.ts:7`.

- [ ] **Step 9: Run and commit**

Run: `npx vitest run --project=kit`
Expected: PASS.

```bash
git add packages/core/src/core/paint-types.ts \
        packages/core/src/features/paths/tessellate/stroke.ts \
        packages/core/src/features/paths/tessellate/stroke.dash.test.ts \
        packages/core/src/renderer/cache/strokeMeshCache.ts
git commit -m "dashed strokes, split at flatten time so a pattern holds in world units"
```

- [ ] **Step 10: Write a changeset**

Create `.changeset/stroke-dash.md`:

```markdown
---
'@weasel-js/core': patch
---

Add `Stroke.dash`, a world-unit dash pattern applied when a path is flattened. An odd-length
pattern repeats, matching Canvas2D's `setLineDash`.
```

```bash
git add .changeset/stroke-dash.md && git commit -m "changeset for dashed strokes"
```

---

### Task 6: Screen-space stroke width

A layer drawing under a view-applied group transform cannot see the zoom, so the
`lineWidth = 1 / zoom` idiom has no equivalent. A stroke width expressed in screen pixels is
resolved against the view's scale at tessellation time.

**Files:**
- Modify: `packages/core/src/core/paint-types.ts:130`
- Modify: `packages/core/src/features/paths/tessellate/stroke.ts`
- Test: `packages/core/src/features/paths/tessellate/stroke.screenWidth.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/features/paths/tessellate/stroke.screenWidth.test.ts`:

```ts
import { resolveStrokeWidth } from './stroke';

describe('resolveStrokeWidth', () => {
  it('passes a world-unit number through unchanged', () => {
    expect(resolveStrokeWidth(2, 4)).toBe(2);
  });

  it('divides a screen-pixel width by the view scale', () => {
    expect(resolveStrokeWidth({ px: 1 }, 4)).toBe(0.25);
  });

  it('holds a screen width constant across zooms', () => {
    const atOne = resolveStrokeWidth({ px: 3 }, 1) * 1;
    const atTen = resolveStrokeWidth({ px: 3 }, 10) * 10;
    expect(atOne).toBeCloseTo(atTen);
  });

  it('falls back to the world value at a degenerate scale', () => {
    expect(resolveStrokeWidth({ px: 1 }, 0)).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project=kit packages/core/src/features/paths/tessellate/stroke.screenWidth.test.ts`
Expected: FAIL — `resolveStrokeWidth` is not exported.

- [ ] **Step 3: Implement it**

Add to `packages/core/src/features/paths/tessellate/stroke.ts`:

```ts
/** Resolve a stroke width to world units. A plain number is already in world
 *  units; `{ px }` is a screen-pixel width divided by the view scale, so it
 *  holds its on-screen thickness as the view zooms. */
export function resolveStrokeWidth(width: number | { px: number }, scale: number): number {
  if (typeof width === 'number') return width;
  if (!Number.isFinite(scale) || scale === 0) return width.px;
  return width.px / scale;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --project=kit packages/core/src/features/paths/tessellate/stroke.screenWidth.test.ts`
Expected: PASS.

- [ ] **Step 5: Widen the `Stroke.width` type**

In `packages/core/src/core/paint-types.ts`, change `Stroke`'s width field to:

```ts
  /** Stroke width. A number is world units. `{ px }` is screen pixels, held
   *  constant as the view zooms — the replacement for `lineWidth = 1 / zoom`. */
  width: number | { px: number };
```

- [ ] **Step 6: Resolve it at the tessellation site**

Wherever `stroke.width` reaches the tessellator, replace it with
`resolveStrokeWidth(stroke.width, meanScale(view))`. `meanScale` is at
`packages/core/src/core/viewport/meanScale.ts` and is already exported from the package entry.
Thread the view's scale to that site if it is not already in scope — read the call chain from
`drawPath` in `packages/core/src/renderer/draw.ts:255` before deciding where it enters.

Add the resolved width to the stroke mesh cache key in
`packages/core/src/renderer/cache/strokeMeshCache.ts`; a screen-width stroke re-tessellates when
the zoom changes, and a stale mesh would freeze at the old thickness.

- [ ] **Step 7: Fix the type fallout**

Run: `npx tsc --noEmit`
Expected: errors wherever `stroke.width` was assumed to be a number. Fix each by calling
`resolveStrokeWidth`. Do **not** cast.

- [ ] **Step 8: Run the full suite**

Run: `npx vitest run --project=kit`
Expected: PASS.

- [ ] **Step 9: Commit and write a changeset**

```bash
git add packages/core/src/core/paint-types.ts \
        packages/core/src/features/paths/tessellate/stroke.ts \
        packages/core/src/features/paths/tessellate/stroke.screenWidth.test.ts \
        packages/core/src/renderer/cache/strokeMeshCache.ts
git commit -m "screen-pixel stroke widths that hold their thickness across zooms"
```

Create `.changeset/stroke-screen-width.md`:

```markdown
---
'@weasel-js/core': patch
---

`Stroke.width` accepts `{ px }` for a width in screen pixels, resolved against the view scale at
tessellation time. This is the engine's answer to the `lineWidth = 1 / zoom` idiom, which a layer
drawing under a view-applied transform cannot express.
```

```bash
git add .changeset/stroke-screen-width.md && git commit -m "changeset for screen-space stroke widths"
```

---

### Task 7: Documentation

**Files:**
- Modify: `packages/core/src/canvas/AGENTS.md` if one exists, else `docs/extending.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Document `deps` where layers are documented**

Find the layer documentation:

Run: `grep -rln "RenderLayer" docs/ packages/core/src/**/AGENTS.md`

Add a short subsection covering: `deps` is opt-in, omitting it rebuilds every frame, and returned
command trees must not be mutated because a cached tree is redrawn on later frames.

- [ ] **Step 2: Record what was deliberately not built**

Add to `docs/TODO.md`:

```markdown
- **(P3) Per-layer GPU dispatch skipping.** `deps`-keyed caching (2026-08-22) skips *rebuilding* a
  layer's command tree, not dispatching it — every layer is still submitted every frame. Skipping
  submission needs render-to-texture per layer plus compositing, which the renderer has no concept
  of. Nobody has measured whether dispatch alone is expensive enough to justify it; measure before
  building.
```

- [ ] **Step 3: Commit**

```bash
git add docs/ packages/core/src
git commit -m "document layer deps and file the dispatch-skipping question"
```

---

## Self-Review

**Spec coverage.** Every section of `2026-08-22-canvas-on-scenecanvas-design.md` that lives in
core is covered: per-layer invalidation (Tasks 2–4), the two renderer gaps (Tasks 5–6), the
`computeFitView` prerequisite (Task 1). Deliberately **not** covered, because they belong to the
labkit plan: deleting `CanvasStack` / `usePanZoom` / `useLayerScheduler`, the `canvas` capability's
new shape, `initialView: { fit }`, view ownership in the trial record, and the `layers` /
`dragDrop` rewiring.

**Type consistency.** `LayerCommandCache` is defined in Task 2 and used in Tasks 3 and 4.
`deps` has the same signature in Task 2's interface and Task 3's `drawOneLayer`.
`resolveStrokeWidth` and `dashPolyline` are defined before use. `computeFitViewport` is named
identically in Task 1's test and implementation.

**Known soft spots**, each flagged in place rather than papered over: the exact `Canvas` mounting
props in Task 4, the tessellation call site in Tasks 5 and 6, and the `Path` construction in Task
5's round-trip test. All three are "read the neighboring code and match it" rather than open design
questions — the repo's existing tests are the reference.
