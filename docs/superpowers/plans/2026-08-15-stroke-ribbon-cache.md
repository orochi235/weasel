# Stroke Ribbon Mesh Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop re-tessellating stroke ribbons every frame by caching them on `Path` identity, and give a ribbon that survives a frame a persistent GL upload instead of a per-frame transient one.

**Architecture:** A new `renderer/cache/strokeMeshCache.ts` holding `WeakMap<Path, Map<string, StrokeEntry>>`. The inner key covers the stroke parameters that change ribbon geometry; `vertexWidths` is compared by reference instead. `strokeMesh()` returns `{ mesh, hit }`, and `hit` decides the upload route at the call site — `handleFor` (persistent) on a hit, `uploadTransient` (freed at end of frame) on a miss. A path whose geometry animates mints a new `Path` per frame, so it never hits and never accumulates GL resources; that is the whole eviction story. Design: `docs/superpowers/specs/2026-08-15-stroke-ribbon-cache-design.md`.

**Tech Stack:** TypeScript, vitest, WebGL2. Repo is `~/src/weasel`, npm workspaces, package under test is `packages/core`.

---

## Background you need

Read these before Task 1:

- `packages/core/src/renderer/cache/cache.ts` — the fill cache. Sets the identity-not-content contract this one inherits.
- `packages/core/src/renderer/cache/outlineStrokeMeshCache.ts` — the same job for glyph ribbons. Its key builder is the model for ours, and its "clear the map wholesale at the limit" is the eviction idiom we copy.
- `packages/core/src/renderer/cache/GLMeshCache.ts` — `handleFor(mesh)` is a `WeakMap<Mesh, GLMeshHandle>` whose GL resources are released by a `FinalizationRegistry`; `uploadTransient(mesh)` allocates fresh resources freed deterministically at end of frame. A stable `Mesh` object is all `handleFor` needs to reuse one VAO forever.

`PathVerb` values used in test fixtures: `M = 0`, `L = 1`, `Z = 4`.

## File structure

| File | Responsibility |
|---|---|
| Create `packages/core/src/renderer/cache/strokeMeshCache.ts` | The cache: key builder, store, `strokeMesh()`, per-path cap. |
| Create `packages/core/src/renderer/cache/strokeMeshCache.test.ts` | Unit tests for keying, hit/miss, and the cap. |
| Modify `packages/core/src/renderer/draw.ts` | Two call sites route through the cache and pick their upload by `hit`. |
| Create `packages/core/src/renderer/draw.strokeCache.test.ts` | GL-recorder tests that no VAO is minted on a repeat frame, and that an animated stroke stays transient. |
| Modify `docs/TODO.md`, `docs/handoffs/2026-08-14-batched-dispatch.md` | Record the result. |

---

### Task 1: The cache module

**Files:**
- Create: `packages/core/src/renderer/cache/strokeMeshCache.ts`
- Test: `packages/core/src/renderer/cache/strokeMeshCache.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/renderer/cache/strokeMeshCache.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type { PolygonPath, RectPath, Stroke } from '@weasel-js/core';
import {
  strokeMesh,
  _resetStrokeMeshCacheForTests,
  STROKE_CONFIGS_PER_PATH,
} from './strokeMeshCache';

const rect = (): RectPath => ({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 });
const base: Stroke = { width: 2, paint: { color: '#000000' } };

describe('stroke ribbon cache', () => {
  beforeEach(() => {
    _resetStrokeMeshCacheForTests();
  });

  it('misses on first sight and hits on the second, returning the same Mesh', () => {
    const path = rect();
    const first = strokeMesh(path, base, undefined);
    const second = strokeMesh(path, base, undefined);
    expect(first.hit).toBe(false);
    expect(second.hit).toBe(true);
    expect(second.mesh).toBe(first.mesh);
  });

  it('misses when a geometry-affecting parameter changes', () => {
    const path = rect();
    strokeMesh(path, base, undefined);
    expect(strokeMesh(path, { ...base, width: 4 }, undefined).hit).toBe(false);
    expect(strokeMesh(path, { ...base, cap: 'round' }, undefined).hit).toBe(false);
    expect(strokeMesh(path, { ...base, join: 'bevel' }, undefined).hit).toBe(false);
    expect(strokeMesh(path, { ...base, miterLimit: 2 }, undefined).hit).toBe(false);
    expect(strokeMesh(path, { ...base, align: 'inner' }, undefined).hit).toBe(false);
    expect(strokeMesh(path, { ...base, dash: [2, 2] }, undefined).hit).toBe(false);
  });

  it('hits when only paint changes — colors are not geometry', () => {
    const path = rect();
    strokeMesh(path, base, undefined);
    const again = strokeMesh(path, { ...base, paint: { color: '#ff0000' } }, undefined);
    expect(again.hit).toBe(true);
  });

  it('hits when only vertexColors change', () => {
    const path = rect();
    strokeMesh(path, base, undefined);
    const withColors = strokeMesh(path, { ...base, vertexColors: [1, 0, 0, 1] }, undefined);
    expect(withColors.hit).toBe(true);
  });

  it('misses on an equal-content but newly allocated vertexWidths array', () => {
    const path = rect();
    const widths = [1, 2, 3, 4];
    strokeMesh(path, { ...base, vertexWidths: widths }, undefined);
    expect(strokeMesh(path, { ...base, vertexWidths: widths }, undefined).hit).toBe(true);
    expect(strokeMesh(path, { ...base, vertexWidths: [1, 2, 3, 4] }, undefined).hit).toBe(false);
  });

  it('misses on a different Path object with equal coords', () => {
    strokeMesh(rect(), base, undefined);
    expect(strokeMesh(rect(), base, undefined).hit).toBe(false);
  });

  it('keys on flattenTolerance', () => {
    const path = rect();
    strokeMesh(path, base, undefined);
    expect(strokeMesh(path, base, 0.1).hit).toBe(false);
    expect(strokeMesh(path, base, 0.1).hit).toBe(true);
  });

  it('drops a path\'s configurations wholesale past the cap', () => {
    const path = rect();
    for (let i = 0; i < STROKE_CONFIGS_PER_PATH; i++) {
      strokeMesh(path, { ...base, width: i + 1 }, undefined);
    }
    expect(strokeMesh(path, { ...base, width: 1 }, undefined).hit).toBe(true);
    // The (cap + 1)th distinct configuration clears the map before storing.
    strokeMesh(path, { ...base, width: STROKE_CONFIGS_PER_PATH + 1 }, undefined);
    expect(strokeMesh(path, { ...base, width: 1 }, undefined).hit).toBe(false);
  });

  it('a churning vertexWidths array replaces one entry instead of evicting the rest', () => {
    const path = rect();
    strokeMesh(path, { ...base, width: 7 }, undefined);
    // Every iteration is a reference miss on the *same* key, so the map never
    // grows and the unrelated width-7 entry must survive all of it.
    for (let i = 0; i < STROKE_CONFIGS_PER_PATH * 3; i++) {
      strokeMesh(path, { ...base, vertexWidths: [i, i] }, undefined);
    }
    expect(strokeMesh(path, { ...base, width: 7 }, undefined).hit).toBe(true);
  });

  it('returns an empty mesh for a zero-width stroke without throwing', () => {
    const poly: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([0, 1]),
      coords: new Float32Array([0, 0, 10, 0]),
      fillRule: 'nonzero',
    };
    const { mesh } = strokeMesh(poly, { ...base, width: 0 }, undefined);
    expect(mesh.indices.length).toBe(0);
  });
});
```

Note on the churning-`vertexWidths` test: each call passes a *new* array, so every call is a reference miss on the same key — the entry is replaced, not appended. That is what the `entry === undefined &&` guard in the implementation buys, and without it a pressure-driven pencil stroke would evict every other configuration on that path every eight frames.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/core/src/renderer/cache/strokeMeshCache.test.ts`
Expected: FAIL — `Failed to resolve import "./strokeMeshCache"`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/renderer/cache/strokeMeshCache.ts`:

```ts
/**
 * Tessellated stroke ribbons for scene paths, keyed on `Path` identity.
 *
 * The sibling of `cache.ts` (fills) and `outlineStrokeMeshCache.ts` (glyph
 * ribbons in em space), and it inherits their contract: identity, not content.
 * A `Path` rebuilt with equal coords is a distinct entry.
 *
 * ### Why a hit, not a store, earns a persistent GL upload
 *
 * `hit` tells the caller the mesh has already survived a frame, so it can take
 * `GLMeshCache.handleFor` and reuse one VAO from then on. A path whose geometry
 * animates mints a new `Path` every frame and so never hits — it keeps the
 * transient upload, freed deterministically at end of frame, rather than a
 * persistent one whose release waits on `FinalizationRegistry`. That gate is
 * the entire eviction story for animated paths.
 */

import type { Path, Stroke } from '@weasel-js/core';
import { tessellateStroke } from 'features/paths/tessellate/stroke';
import type { Mesh } from './mesh';

/**
 * Distinct stroke configurations kept per path before that path's map is
 * dropped wholesale. A document uses a handful; a width slider passes this on
 * its first drag and then degrades to tessellating every frame, which is what
 * it did before this cache existed.
 */
export const STROKE_CONFIGS_PER_PATH = 8;

interface StrokeEntry {
  readonly mesh: Mesh;
  /** Compared by reference — long enough that stringifying it per frame would
   *  cost what the cache saves. */
  readonly vertexWidths: number[] | undefined;
}

let cache = new WeakMap<Path, Map<string, StrokeEntry>>();

/** The stroke parameters that change the ribbon's geometry. `paint` and
 *  `vertexColors` are absent on purpose: both are applied over the same
 *  triangles at draw time. */
function configKey(stroke: Stroke, flattenTolerance: number | undefined): string {
  return [
    stroke.width ?? 1,
    stroke.cap ?? 'butt',
    stroke.join ?? 'miter',
    stroke.miterLimit ?? '',
    stroke.align ?? 'center',
    (stroke.dash ?? []).join(','),
    stroke.varyingWidthJoinThreshold ?? '',
    flattenTolerance ?? '',
  ].join('|');
}

/**
 * The tessellated ribbon for `path` under `stroke`. `hit` is true when the
 * returned mesh came from the cache, meaning it is stable across frames and
 * safe to hand to `GLMeshCache.handleFor`.
 */
export function strokeMesh(
  path: Path,
  stroke: Stroke,
  flattenTolerance: number | undefined,
): { mesh: Mesh; hit: boolean } {
  let byConfig = cache.get(path);
  if (byConfig === undefined) {
    byConfig = new Map<string, StrokeEntry>();
    cache.set(path, byConfig);
  }

  const key = configKey(stroke, flattenTolerance);
  const entry = byConfig.get(key);
  if (entry !== undefined && entry.vertexWidths === stroke.vertexWidths) {
    return { mesh: entry.mesh, hit: true };
  }

  const mesh = tessellateStroke(path, stroke, { flattenTolerance });
  // Only a new key grows the map; replacing one under a churning
  // `vertexWidths` must not evict the other configurations alongside it.
  if (entry === undefined && byConfig.size >= STROKE_CONFIGS_PER_PATH) byConfig.clear();
  byConfig.set(key, { mesh, vertexWidths: stroke.vertexWidths });
  return { mesh, hit: false };
}

/** Test helper. Do not call from product code. */
export function _resetStrokeMeshCacheForTests(): void {
  cache = new WeakMap();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/core/src/renderer/cache/strokeMeshCache.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p packages/core`
Expected: no output.

If `tsc` reports that `-p packages/core` has no tsconfig, run the repo-level `npm run typecheck` instead and expect no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/renderer/cache/strokeMeshCache.ts packages/core/src/renderer/cache/strokeMeshCache.test.ts
git commit -m "cache tessellated stroke ribbons by path identity"
```

---

### Task 2: Route the unclipped stroke path through the cache

**Files:**
- Modify: `packages/core/src/renderer/draw.ts` (import block ~line 23; `drawPathStrokeUnclipped` at 969–1022)

- [ ] **Step 1: Add the import**

In `packages/core/src/renderer/draw.ts`, directly below the existing
`import { outlineStrokeMesh, quantizeEmWidth } from './cache/outlineStrokeMeshCache';`:

```ts
import { strokeMesh } from './cache/strokeMeshCache';
```

Leave the existing `import { tessellateStroke } from 'features/paths/tessellate/stroke';` in place — `drawText`'s glyph path still calls it directly.

- [ ] **Step 2: Replace the tessellation and the upload**

In `drawPathStrokeUnclipped`, replace these lines:

```ts
  const mesh = tessellateStroke(cmd.path, stroke, { flattenTolerance: ctx.flattenTolerance });
  if (mesh.indices.length === 0) return;
```

with:

```ts
  const { mesh, hit } = strokeMesh(cmd.path, stroke, ctx.flattenTolerance);
  if (mesh.indices.length === 0) return;
```

Then replace these lines:

```ts
  flushSolids(ctx);
  // tessellateStroke returns a freshly-built Mesh every frame; route through
  // the transient pool so the renderer frees these at end-of-frame.
  const handle = ctx.meshCache.uploadTransient(mesh);
```

with:

```ts
  flushSolids(ctx);
  // A cached ribbon is stable across frames, so it earns a persistent VAO. A
  // fresh one may never be seen again — transient, freed at end of frame.
  const handle = hit ? ctx.meshCache.handleFor(mesh) : ctx.meshCache.uploadTransient(mesh);
```

Leave the comment above `pushMesh` (`// A ribbon is rebuilt every frame, so its own draw means…`) alone for now; Task 5 rewrites it, since it is now describing something that stopped being true.

- [ ] **Step 3: Run the renderer tests**

Run: `npx vitest run packages/core/src/renderer`
Expected: PASS. `solidBatch.test.ts`'s 18 tests and `draw.test.ts` should be green without modification. If a `draw.test.ts` case now fails on a *count* of `createVertexArray` or `createBuffer`, that is this change working — read the test before adjusting it, and only relax an assertion that was pinning transient-upload counts rather than draw ordering.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/renderer/draw.ts
git commit -m "draw stroke ribbons from the path-identity cache"
```

---

### Task 3: Route the stenciled stroke path through the cache

**Files:**
- Modify: `packages/core/src/renderer/draw.ts` (`drawPathStrokeStenciled`, 1024–1037)

- [ ] **Step 1: Replace the tessellation and the upload**

In `drawPathStrokeStenciled`, replace:

```ts
  const ribbonMesh = tessellateStroke(cmd.path, widerStroke, { flattenTolerance: ctx.flattenTolerance });
  if (ribbonMesh.indices.length === 0) return;
  // The ribbon mesh is freshly tessellated each frame; transient.
  const ribbonHandle = ctx.meshCache.uploadTransient(ribbonMesh);
```

with:

```ts
  const { mesh: ribbonMesh, hit } = strokeMesh(cmd.path, widerStroke, ctx.flattenTolerance);
  if (ribbonMesh.indices.length === 0) return;
  const ribbonHandle = hit
    ? ctx.meshCache.handleFor(ribbonMesh)
    : ctx.meshCache.uploadTransient(ribbonMesh);
```

`widerStroke` is a fresh object every frame (`{ ...stroke, width: (stroke.width ?? 1) * 2, align: 'center' }`), which is harmless — the key is built from values, not from the `Stroke` object's identity.

- [ ] **Step 2: Run the renderer tests**

Run: `npx vitest run packages/core/src/renderer`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/renderer/draw.ts
git commit -m "draw stenciled stroke ribbons from the cache"
```

---

### Task 4: Pin the upload semantics against a GL recorder

**Files:**
- Create: `packages/core/src/renderer/draw.strokeCache.test.ts`

The unit tests in Task 1 pin the cache. These pin what the *renderer* does with it, which is the half that can silently regress: promoting an animated path to a persistent handle would leak GL resources without failing anything else.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/renderer/draw.strokeCache.test.ts`:

```ts
/**
 * What the renderer does with a cached stroke ribbon. A ribbon large enough to
 * miss the solid batch takes its own draw, and that draw's VAO is the thing
 * under test: minted every frame for a path that keeps changing, minted once
 * for one that does not.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { PolygonPath } from '@weasel-js/core';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { _resetStrokeMeshCacheForTests } from './cache/strokeMeshCache';

const M = 0, L = 1;

/** An open polyline whose ribbon comfortably exceeds the solid batch's
 *  256-vertex ceiling, so it takes its own draw rather than being batched. */
function bigPolyline(): PolygonPath {
  const n = 200;
  const commands = new Uint8Array(n);
  const coords = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    commands[i] = i === 0 ? M : L;
    coords[i * 2] = i * 3;
    coords[i * 2 + 1] = (i % 2) * 20;
  }
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

const stroked = (path: PolygonPath, width: number): DrawCommand => ({
  kind: 'path',
  path,
  stroke: { width, paint: { color: '#222222' } },
});

describe('renderer — stroke ribbon caching', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    _resetStrokeMeshCacheForTests();
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
  });

  const vaosCreated = (): number =>
    recorder.calls.filter((c) => c.name === 'createVertexArray').length;

  it('mints no VAO on a repeat frame of the same path and stroke', () => {
    const path = bigPolyline();
    r.render([stroked(path, 2)]);
    recorder.reset();
    r.render([stroked(path, 2)]);
    expect(vaosCreated()).toBe(0);
  });

  it('mints a VAO every frame while the stroke width animates', () => {
    const path = bigPolyline();
    r.render([stroked(path, 2)]);
    recorder.reset();
    r.render([stroked(path, 2.5)]);
    const first = vaosCreated();
    recorder.reset();
    r.render([stroked(path, 3)]);
    expect(first).toBeGreaterThan(0);
    expect(vaosCreated()).toBe(first);
  });

  it('mints a VAO every frame while the path itself is rebuilt', () => {
    r.render([stroked(bigPolyline(), 2)]);
    recorder.reset();
    r.render([stroked(bigPolyline(), 2)]);
    const first = vaosCreated();
    recorder.reset();
    r.render([stroked(bigPolyline(), 2)]);
    expect(first).toBeGreaterThan(0);
    expect(vaosCreated()).toBe(first);
  });

  it('still draws the ribbon on the cached frame', () => {
    const path = bigPolyline();
    r.render([stroked(path, 2)]);
    recorder.reset();
    r.render([stroked(path, 2)]);
    expect(recorder.calls.filter((c) => c.name === 'drawElements').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run packages/core/src/renderer/draw.strokeCache.test.ts`
Expected: PASS, 4 tests.

If the first test fails with a nonzero VAO count, check whether the ribbon is being batched after all — batched geometry never touches `createVertexArray` beyond the batch's own, so a nonzero count means the ribbon took its own draw and `hit` was false. Confirm `bigPolyline()` produces more than 256 ribbon vertices by logging `strokeMesh(path, stroke, undefined).mesh.vertices.length >> 1`.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/renderer/draw.strokeCache.test.ts
git commit -m "pin persistent-vs-transient uploads for stroke ribbons"
```

---

### Task 5: Fix the stale comment and run the visual gate

**Files:**
- Modify: `packages/core/src/renderer/draw.ts` (`drawPathStrokeUnclipped`, the comment above `pushMesh`)

- [ ] **Step 1: Rewrite the comment**

Replace:

```ts
    // A ribbon is rebuilt every frame, so its own draw means a fresh VAO and
    // two fresh buffers per stroke per frame — most of what a stroked command
    // costs. Staged, it allocates nothing and joins the fill it sits on.
```

with:

```ts
    // Staged, a ribbon allocates nothing and joins the fill it sits on.
```

- [ ] **Step 2: Run the visual suite**

Run: `npm run test:visual`
Expected: 35 baselines pass. This is the gate that matters — a ribbon served under the wrong key is a pixel difference, not a test failure anywhere else.

Run one Playwright suite at a time. Two concurrent runs share `test-results/` and delete each other's artifacts, which surfaces as a timeout plus `ENOENT ... .trace` rather than as anything about the code.

- [ ] **Step 3: Run the full unit suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/renderer/draw.ts
git commit -m "drop a comment the ribbon cache made false"
```

---

### Task 6: Measure and record

**Files:**
- Modify: `docs/handoffs/2026-08-14-batched-dispatch.md`
- Modify: `docs/TODO.md`
- Create: `.changeset/<generated-name>.md`

- [ ] **Step 1: Run the perf sweep**

Run: `npm run test:perf`
Expected: the `stroked` variant at 3,200 commands falls from ~9.41 ms toward ~1.5 ms. The fixture builds one `Path` per command once and the harness reports its *second* timed block, so the number is warm and reflects the hit path.

Record the actual number — the next two steps quote it. If it has not moved, the ribbons are missing the cache; check that the perf fixture is not rebuilding its `Stroke` objects with a varying width.

- [ ] **Step 2: Update the handoff**

In `docs/handoffs/2026-08-14-batched-dispatch.md`, in the `Landed:` line at the top add `cache tessellated stroke ribbons by path identity`. In the Status section, replace the sentence

> And the stroked figure above is now ~85% stroke tessellation, which batching does not touch.

with a sentence naming the measured post-cache figure from Step 1 and saying that stroke tessellation is now paid once per path per stroke configuration rather than per frame. Update the `stroked rects` row of the table to carry the new number.

Also amend the closing line of "Step 3 — What the measurement actually said", which currently reads:

> Still on the table, if stroke tessellation becomes the bottleneck: caching ribbon meshes by path identity plus stroke parameters. It was left out because it needs an eviction story for animated paths that the transient pool did not.

Replace it with a two-sentence note that this landed, and that the eviction story is the hit-gate: a mesh earns a persistent GL handle only on its second sight, so an animated path never gets one. Point at `docs/superpowers/specs/2026-08-15-stroke-ribbon-cache-design.md`.

- [ ] **Step 3: Update the TODO**

In `docs/TODO.md`, under "Release-gate & build hygiene", the "Per-command cost" bullet ends with:

> The stroked figure is now ~85% stroke tessellation, which batching does not touch — a ribbon-mesh cache is the lever there, and it needs an eviction story for animated paths.

Replace that clause with the measured result and drop the "still open" framing for the ribbon cache specifically. Leave the rest of the bullet — gradients, patterns, images, text and shaders still pay per command — untouched, and leave the "Next up" pointer at the top of the file pointing at the same handoff.

- [ ] **Step 4: Write the changeset**

Run: `npx changeset`

Select **all** packages when prompted, and choose **patch**. Every changeset in this repo is `patch` regardless of how significant the change is; `minor` and `major` are Mike's calls, made explicitly. `npm run check:bumps` enforces this.

Body:

```
Cache tessellated stroke ribbons by path identity, so a stroked path is
tessellated once per stroke configuration instead of once per frame. A ribbon
that survives a frame also takes a persistent GL upload rather than a fresh
VAO each frame; one whose path or stroke changes every frame keeps the
transient upload it had before.
```

- [ ] **Step 5: Verify the bump level**

Run: `npm run check:bumps`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/handoffs/2026-08-14-batched-dispatch.md docs/TODO.md .changeset
git commit -m "record the stroke ribbon cache's measured effect"
```

---

## Done when

- `npx vitest run` and `npx tsc --noEmit` are clean.
- `npm run test:visual` passes all 35 baselines.
- `npm run test:perf`'s `stroked` variant is materially below 9.41 ms at 3,200 commands, and the number is written down in the handoff.
- `tests/e2e/bezier-edit.spec.ts` still has its 3 pre-existing failures and no more. Those are on clean `main`; they are not yours.
