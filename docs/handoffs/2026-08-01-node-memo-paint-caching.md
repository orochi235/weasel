# Handoff — `nodeMemo` and paint caching

**Date:** 2026-08-01
**Branch at time of writing:** `arbitration-and-affordance-cleanup`
**Prerequisite (landed):** `perf(picking): memoize the painter match and silhouette per node` (`312ce021`)

---

## Status

**Done** (2026-08-01), steps 1–4 as proposed; step 5 investigated and
deliberately declined, with the reason below. Everything under "Proposed
shape", "Traps" and "Suggested order" is kept as written — read it as the
design record, and this block as what it turned into.

What landed:

1. `packages/core/src/core/scene/nodeMemo.ts` — `nodeMemo(node, slot, pose,
   derive)` + `bumpNodeMemoGeneration()`, exactly the proposed signature.
   `NodeShape` is its first consumer, not the owner of a `WeakMap`; its two
   uses ported unchanged and `NodeShape.cache.test.ts` stayed green untouched.
2. Trap 1 fixed: `defaultDrawOne` copies before appending the label overlay.
   Pinned by `defaultDrawOne.test.ts` › "does not mutate the array its painter
   returned", which uses a painter returning a memoized array — it grew to 3
   commands in two draws before the fix.
3. `kit:shape` and `kit:path` memoize `paint` under a `shape:paint` slot,
   separate from the silhouette's per trap 5.
4. Measured. `NodeShape.meshCache.test.ts` drives `getMesh` from real paint
   output and counts distinct meshes, with the **pre-memo painter as a control
   arm in the same file** — so the regression is guarded by the number in the
   other column rather than by a historical red.

| 1000 shape nodes (ellipse / polygon / star), paint → `getMesh` | ms/frame |
|---|---|
| before (fresh `Path` per frame) | 6.69 |
| after (memoized `paint`) | 0.20 |

Meshes built over 5 frames of 200 nodes: **1000 → 200**. The mesh cache's hit
rate went from 0% to (frames−1)/frames. So the diagnosis in step 4's "if it
doesn't move, something else is defeating `WeakMap<Path, Mesh>`" was right and
the check passes — the allocation upstream was the whole story.

### Step 5: neither `kit:text` nor `kit:image` should join, and trap 4 is wrong

**Trap 4 mis-locates the cost.** `kit:text`'s `paint` does *not* run
`layoutRuns`. It builds a `TextDrawCommand` via `resolveTextStyle` +
`resolveRuns` — pure style merging, no font reads, measured at **0.139
ms/frame for 1000 text nodes** (shape paint, memoized, is 0.101 for
comparison). There is nothing there worth caching.

`layoutRuns` runs one layer down, in `drawText` (`renderer/draw.ts`), on the
emitted command. And it is not memoizable per node at all: its `outlineMinSize`
argument is `textOutlineMinScreenSize / modelScale(ctx.state.transform)` — the
**view zoom** — because that is what picks the atlas-vs-outline tier per glyph.
A `(node, pose, data)` key structurally cannot represent it. Text layout wants
a renderer-side cache with its own key; filed as its own P3 entry in
`docs/TODO.md` § Rendering & paint.

**`kit:image` stays out**, and traps 2 and 3 both hold up: `ctx.resolveImage`
is authoritative when set and absent from the key, and `getImageBitmap` flips
when an async decode lands with no change to `data`. The win would also be
nil — image paint emits one command and tessellates nothing.

Both opt-outs are pinned by tests in `NodeShape.cache.test.ts` so a later pass
doesn't quietly fold them in.

## Why

Two separate findings, one cause.

**1. The kit's mesh cache is missing on nearly every draw.**
`packages/core/src/renderer/cache/cache.ts` memoizes tessellation as
`WeakMap<Path, Mesh>`, keyed on **`Path` object identity**. That only pays off
if the same `Path` object is handed back frame after frame. It isn't:

- `SHAPE_PAINTER.paint` calls `pathForShape(d, pose)`, which builds a new
  `PolygonPath` — new `Uint8Array` commands, new `Float32Array` coords — for
  every ellipse, polygon and star, every frame.
- `PATH_PAINTER.paint` calls `pathInPoseFrame(d.path, pose)`. That returns the
  input by reference only for the `kind: 'rect'` identity case; the polygon
  branch rebases the AABB into the pose box and allocates.

So for the shape family the kit ships, the tessellation cache is allocated,
consulted, missed, and repopulated every frame. Fixing the allocation upstream
turns an existing, already-written cache on. That's a larger win than the
picking one and most of the work is already paid for.

**2. The key generalizes.** The memo landed in `NodeShape.ts` is keyed on a
fact about the *engine*, not about picking:

> The scene mutates node objects in place but **replaces** `pose` and `data`
> with new references — see the `kit:setPose` / `kit:setData` ops in
> `core/scene/scene.ts`, which do `node.pose = p.to` / `node.data = p.to`.

So `(node identity, pose reference, data reference)` is an exact freshness
signal for anything derived per node. Picking is one consumer. Paint is a
hotter one. Container clipping, lasso/area-select and text layout are others.

## What exists now

`packages/core/src/canvas/NodeShape.ts` holds a private `SHAPE_CACHE`:

```ts
const SHAPE_CACHE = new WeakMap<object, ShapeCacheEntry>();
interface ShapeCacheEntry {
  generation: number;      // painterGeneration at fill time
  painter: NodeShapeEntry | undefined;
  pose: unknown;           // reference-compared
  data: unknown;           // reference-compared
  silhouette: Path | null;
  hasSilhouette: boolean;
}
```

`findNodeShape` memoizes the `matches` walk on `data`; `findShapeSilhouette`
memoizes the (already rotation-baked) path on `pose` + `data`.
`painterGeneration` is bumped by `registerNodeShape`, its disposer, and
`_resetShapePaintersForTests`. Behavior is pinned by
`packages/core/src/canvas/NodeShape.cache.test.ts` — read that first; it
enumerates the invalidation conditions.

Measured, 1000-node scene, one pick, pointer at rest:

| | µs/pick |
|---|---|
| pose only | 27.7 |
| shape, cache hit | 30.7 |
| shape, cache miss | 109.0 |

## Proposed shape

Extract `packages/core/src/core/scene/nodeMemo.ts`, and make `NodeShape` its
first consumer rather than the owner of a bespoke `WeakMap`.

```ts
/** Memoize a value derived from a node, keyed on the node's identity and the
 *  `pose` / `data` references the scene swaps on every edit. */
export function nodeMemo<T>(
  node: object,
  slot: string,            // several derivations coexist per node
  pose: unknown,
  derive: () => T,
): T;

/** Invalidate every slot everywhere. For registries whose contents change
 *  what `derive` would return (the shape-painter set is one). */
export function bumpNodeMemoGeneration(): void;
```

Notes on the signature, from the picking work:

- **`slot` is needed.** A node has more than one derived value (painter match,
  silhouette, draw commands, layout) and they invalidate on the same signals
  but must not overwrite each other.
- **`pose` is a parameter, not read off the node.** Callers legitimately pass a
  pose that isn't `node.pose` — a preview/ghost pose mid-drag. Those must miss
  and recompute, and must not poison the entry for the real pose. The landed
  cache gets this right and `NodeShape.cache.test.ts` pins it
  (`does not cache a preview pose over the node's own`).
- **`data` is read off the node**, not passed — no caller has ever had a
  reason to derive against data the node doesn't hold.
- **Generation, not manual invalidation.** A registry mutating underneath a
  cached entry is the failure mode that a `(pose, data)`-only key cannot see;
  the landed test `invalidates when a painter is registered after the fact`
  is the regression that catches it.

## Traps — read before touching `paint`

**1. `defaultDrawOne` mutates the painter's return value.**

```ts
const primary = painter ? painter.paint(node, pose, ctx) : [];
if (data?.label && data.text == null) {
  primary.push(textCommand(...));   // <-- mutates
}
```

Hand a cached array to that and it grows another label command per frame,
unboundedly. Fix before caching: either treat the cached array as immutable
and copy-on-append, or move the label emission into the painters so the cached
value is already complete. The second is cleaner and matches the trait
direction — but it touches every painter.

**2. `paint` takes a `ctx` the key doesn't cover.**
`NodePaintCtx.resolveImage` is supplied by the headless `renderSceneToPixels`
path so consumers can plug in their own decode cache; when set it is
*authoritative* and the global `imageCache` is not consulted. A cache keyed
only on `(node, pose, data)` will serve an on-screen render's commands to a
headless render, or vice versa. Either fold `ctx` identity into the key, scope
the cache per render pass, or skip caching for painters that read `ctx`
(`kit:image` is the only built-in that does).

**3. Image nodes are not a pure function of `(node, pose, data)`.**
`kit:image`'s `paint` reads `getImageBitmap` / `imageStatus`, which change when
an async decode lands — with no change to `data`. `subscribeImageReady` →
`requestRedraw` is what currently repaints them. Caching them needs the ready
subscription to also bump their entry, or `kit:image` opts out.

**4. Text is the prize and the hazard.** `kit:text`'s `paint` runs
`layoutRuns`, the most expensive derivation in the kit, so it benefits most.
But its output depends on the loaded font set, which is ambient and mutable.
Whatever signal invalidates text layout on font load has to reach the memo.

> **This trap is wrong** — see the Status block. `kit:text`'s `paint` does not
> run `layoutRuns`; the renderer does, one layer down, keyed partly on view
> zoom. Left in place because the reasoning is the trap worth remembering even
> though this instance of it was misfiled.

**5. Don't cache `silhouette` and `paint` into one entry keyed the same way
and assume they invalidate together.** They mostly do, but `ctx` and image
readiness only affect paint. Separate slots, per trap 2.

## Suggested order

1. Extract `nodeMemo`, port `NodeShape`'s two uses onto it, keep
   `NodeShape.cache.test.ts` green unchanged. Pure refactor, no behavior.
2. Fix trap 1 (the `primary.push` mutation) on its own, with a test that draws
   a labelled node twice and asserts one label command. Also pure behavior
   preservation, and independently correct.
3. Cache `paint` for the painters with no ambient input — `kit:shape` and
   `kit:path`. That is where the mesh-cache win is; those two are exactly the
   painters that allocate a fresh `Path` per frame.
4. Measure the mesh cache's hit rate before and after. If it doesn't move,
   something else is defeating `WeakMap<Path, Mesh>` and step 3 was the wrong
   diagnosis — check that before extending to `kit:text` or `kit:image`.
5. Only then consider text and images, each against its own trap above.

## Cross-references

- `docs/TODO.md` § Rendering & paint — the P2 entry pointing here.
- `docs/TODO.md` § Tools & gestures — geometry-accurate picking, which is what
  made the silhouette cost hot enough to notice.
- `packages/core/src/canvas/NodeShape.cache.test.ts` — the invalidation
  contract, in executable form.
- `packages/core/src/renderer/cache/cache.ts` — the downstream cache this is
  meant to start feeding.
