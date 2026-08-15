# Stroke ribbon mesh cache — design

**Date:** 2026-08-15
**Status:** approved, not implemented

What this is: a cache for tessellated stroke ribbons in the renderer, keyed on
`Path` identity plus the stroke parameters that change the ribbon's geometry.
For anyone touching `renderer/draw.ts`'s stroke path or `renderer/cache/`. It
answers what to key on, when a cached mesh earns a persistent GL upload, and
what happens to a path whose stroke changes every frame.

## The problem

`drawPathStrokeUnclipped` calls `tessellateStroke` on every stroked command on
every frame and throws the result away. Batched dispatch (see
`docs/handoffs/2026-08-14-batched-dispatch.md`) took 3,200 stroked commands from
243.80 ms to 9.41 ms, and **7.9 of the remaining 9.41 ms is that tessellation** —
batching moves buffer writes, it does not avoid rebuilding geometry.

A second cost sits behind it: a ribbon too large for the solid batch
(`MAX_BATCHED_MESH_VERTICES`, 256 vertices) takes its own draw through
`meshCache.uploadTransient`, minting a VAO and two buffers per stroke per frame.
That was ~16 ms of the original 243.80 ms, and it lands on exactly the large
paths where tessellation is dearest.

## Design

A new `packages/core/src/renderer/cache/strokeMeshCache.ts`, sibling to
`cache.ts` (fills, `Path`-identity `WeakMap`) and `outlineStrokeMeshCache.ts`
(glyph ribbons in em space, string key).

```ts
export function strokeMesh(
  path: Path,
  stroke: Stroke,
  flattenTolerance: number | undefined,
): { mesh: Mesh; hit: boolean };
```

**Store:** `WeakMap<Path, Map<string, StrokeEntry>>`.

**Key:** the parameters that change the ribbon's geometry — `width`, `cap`,
`join`, `miterLimit`, `align`, `dash`, `varyingWidthJoinThreshold`, and
`flattenTolerance`. `vertexColors` is deliberately absent: it is paint, applied
through a per-draw color VBO over the same triangles, so a color change must
hit. `vertexWidths` does change geometry but is too long to stringify per frame,
so the entry stores the array reference and a hit requires `===` against it.

`flattenTolerance` in the key is a small divergence from fills, where
`fillMesh` bypasses the cache entirely under a custom tolerance because a
`WeakMap<Path, Mesh>` has nowhere to put a second key dimension. There is an
inner keyed map here anyway, so the tolerance rides along for free.

**Persistence is gated on a hit.** A miss returns a freshly tessellated mesh and
the caller uploads it transient, exactly as today. A hit returns a mesh that has
already survived a frame, so the caller routes it through
`meshCache.handleFor(mesh)` for a persistent VAO reused every frame after.

That gate is the whole eviction story. A path whose geometry animates mints a
new `Path` object per frame, so it never hits, never earns a persistent handle,
and keeps today's deterministic end-of-frame free — while its stale entries
leave with the `Path` under the outer `WeakMap`, needing no eviction pass at
all. Promoting on first sight instead would hand every frame of a pencil drag a
persistent VAO whose release waits on `FinalizationRegistry`, which is the
regression this shape exists to avoid.

**One bounded case remains:** stroke parameters animating over a *stable* path,
such as a width slider. Every frame is a miss, so no GL resources accumulate,
but the inner map would grow one entry per frame. Cap it at
`STROKE_CONFIGS_PER_PATH = 8` and clear wholesale on exceed, the move
`outlineStrokeMeshCache` already makes at its own limit. A document uses a
handful of stroke configurations per path; a slider blows past eight
immediately and then degrades to exactly today's behavior.

Both caches inherit the contract `getMesh` already documents: identity, not
content. A `Path` rebuilt with equal coords is a distinct entry.

## Call sites

`drawPathStrokeUnclipped` (`draw.ts:972`) and `drawPathStrokeStenciled`
(`draw.ts:1034`) replace their `tessellateStroke` call, and their
`uploadTransient` becomes `hit ? meshCache.handleFor(mesh) : uploadTransient(mesh)`.
The stenciled path builds a fresh `widerStroke` object each frame; keying on
values rather than on the `Stroke` object makes that harmless.

The batched path is unchanged — `SolidBatch.pushMesh` reads `vertices` and
`indices` and copies transformed values out, and every `Mesh` field is
`readonly`, so sharing one mesh across frames and across commands is safe.

## Testing

`strokeMeshCache.test.ts`, new:

- a repeat call with the same path and stroke returns the identical `Mesh`
  object and `hit: true`; the first returns `hit: false`
- a changed `width`, `cap`, `join`, `miterLimit`, `align`, `dash` or
  `flattenTolerance` misses; a changed `vertexColors` or paint color hits
- an equal-content but newly-allocated `vertexWidths` array misses — pinning the
  identity contract rather than leaving it to prose
- a new `Path` object with equal coords misses
- a ninth distinct configuration on one path clears that path's map

`draw.test.ts`, against the existing GL recorder: a stroked command's second
frame creates no VAO or buffers, and a per-frame-varying width creates transient
resources every frame and never a persistent handle.

`solidBatch.test.ts` needs no change; its 18 flush-boundary tests should stay
green untouched.

## Verification

- `npm run test:visual` — 35 baselines. The gate that matters: a ribbon reused
  under the wrong key shows up as pixels.
- `npm run test:perf` — the `stroked` variant, expected to fall from ~9.41 ms
  toward ~1.5 ms at 3,200 commands. The fixture builds one `Path` per command
  once and the harness reports its second timed block, so the measurement is
  warm and will show the hit path.
- Run one Playwright suite at a time; two concurrent runs share `test-results/`
  and delete each other's artifacts.
- `tests/e2e/bezier-edit.spec.ts` has 3 failures on clean `main`. Pre-existing.

## Out of scope

Caching the fill side under the same key (fills already have `getMesh`),
backporting `flattenTolerance` into the fill cache's key, and any change to
`tessellateStroke` itself. Stroke tessellation stays as costly as it is; this
only stops paying for it every frame.
