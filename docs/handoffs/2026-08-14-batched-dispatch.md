# Handoff — batched dispatch in the renderer

**Date:** 2026-08-14
**Branch:** `main`
**Landed:** `batch consecutive rect fills into one draw call` (`2604ce24`)

What this is: the plan for getting the renderer's draw loop from one GL draw
call per command down to roughly one per frame, and the record of the first
step, which landed and does not yet pay off where it matters. Read it before
touching `renderer/draw.ts`, `renderer/rectBatch.ts`, or `canvas/buildSceneTree.ts`.

---

## Status

Step 0 landed. Consecutive solid-fill rects merge into one `drawElements`
through the existing `pathFillVColor` program, with color on a vertex attribute
and `u_color` held at white. On an M2 Max via ANGLE at 800x600, a **flat**
stream of 3,200 rects went 211.78 ms → 0.15 ms a frame.

**It does not reach `SceneCanvas`.** `buildSceneTree` wraps every node in its
own `kind: 'group'` with no transform, alpha, colorMatrix, or clip
(`buildSceneTree.ts:102` — deliberate, to keep the per-node tree shape stable),
and `drawGroup` flushes the batch unconditionally at both ends. Both real render
paths go through it (`Canvas.tsx:649`, `sceneViewRender.ts:163`). Measured with
a recorder: 50 rects flat produce **1** draw call, the same 50 in the shape the
scene emits produce **50**.

Those wrapper groups are provably no-ops: `GroupState.push` with no fields
returns the *same references* for transform, alpha, and colorMatrix
(`GroupState.ts:63`). The flush happens for a state change that cannot occur.

## The defect this exposes

Dispatch uses **structural boundaries as a proxy for state changes**. A group is
a barrier because it *might* move a uniform. One level down, `draw.ts` already
answers that question correctly — `UploadedUniforms` + `sameValues` skip an
upload when the value did not actually change. The batch should break on the
same test.

Everything below follows from that: stop letting uniforms be barriers, by first
comparing them honestly, then by moving them off uniforms entirely.

## Step 1 — break on state, not on structure

Stage the batch alongside the `(transform, alpha, colorMatrix, clipDepth)` it
was built under. A group that does not move them keeps the run alive.

Traps:

- **Compare by value, not by reference.** Reference equality catches the no-op
  group, but a group carrying an identity-valued transform goes through
  `mat3.multiply`, which allocates a new array with equal values. Use the
  existing `sameValues`. Nine float compares against a 66 us draw call is not a
  trade worth thinking about.
- **`clipDepth` is part of the staged state, and clip changes stay hard flush
  points.** `pushClip` / `popClip` rasterize into the stencil buffer. A batch
  that survived past `popClip` would draw with the *wrong* ancestor mask —
  pixels that belonged inside the clip, painted after it was torn down. Flush
  before mutating `clipDepth`, not after noticing it changed.
- `dispatch` must keep flushing before text, image, and shader commands. Those
  bind other programs and the state test says nothing about that.

Verify: the scene-shaped case above should collapse to 1 draw.

## Step 2 — bake state into the vertices

The batch already writes corners CPU-side. Applying the model matrix there is
~12 flops against 66 us for a draw call. An affine maps a rect to a
parallelogram, so the two-triangle index pattern still holds. Alpha and the
color matrix are per-vertex math in the shader today and fold the same way.

That removes transform, alpha, and color matrix as barriers, leaving **clip as
the only real one** for solid geometry — which is honest, because a clip change
is a genuine stencil state change.

Traps:

- **Fold alpha and the color matrix together or not at all.** The shader is
  `mapped = clamp(CM * src + bias); a = mapped.a * u_alpha`. The matrix and the
  clamp apply to straight-alpha `src` *before* the alpha multiply, so folding
  `u_alpha` into the vertex alpha is exact only while `CM` is identity. If the
  CPU applies the matrix per vertex, clamp exactly as the shader does or colors
  drift wherever a matrix pushes a channel out of range.
- **`u_model` gets a second writer.** The batch would upload identity while
  `drawPathFillVColor` uploads the real model to the *same program*, and
  `setProjAndModel`'s per-program cache assumes it is the sole writer — the
  hazard its own comment names for `u_color` / `u_alpha`. Either route the batch
  through its own program instance or teach the cache about both writers.
- CPU transform is float64 where the GPU was float32. Expect equal-or-better,
  but a subpixel baseline shift is plausible; look at the visual diffs rather
  than assuming.

## Step 3 — batch solid-fill meshes, not just rects

Polygons, ellipses, text decoration rules, and stroke ribbons are all triangle
meshes with a solid paint. Append transformed vertices, per-vertex color, and
offset indices and they join the same draw. Commands that already carry
`vertexColors` are per-vertex and join as they are.

Measure before committing to it: at 66 us a draw against a memcpy of a few
hundred floats it is very likely right, but it is the first step that gives
something up.

Traps:

- **Tessellation caching is not what changes.** `getMesh` caches the tessellated
  `Mesh` by `Path` identity and stays exactly as it is; only the GPU-side upload
  moves. Do not delete the mesh cache on the theory that batching replaced it.
- **Stencil fills cannot join.** `handle.requiresStencil` (evenodd) needs its own
  two-pass dance. Hard exclusion, same as a clip.
- The index buffer stops being the static rect pattern and becomes a per-flush
  upload with `+vertexBase` offsets. That is a real cost the current
  `RectBatch` avoids entirely — count it in the measurement.
- `MAX_RECTS_PER_BATCH` becomes a vertex/index budget rather than a rect count.

## Step 4 — one program and atlases

Gradients bind a ramp texture per draw, images a texture, text an atlas page.
Ramps are 1D and atlas into rows of one texture; images go in a texture array;
paint parameters ride per-vertex. Then a frame is one program and near-one draw.
This is a paint-path rewrite — the direction, not a next step.

Traps:

- **Never mipmap the MSDF atlas.** Filtering a distance field destroys it. Keep
  the text atlas out of any shared image atlas rather than trusting a flag on
  `GLTextureCache`.
- Text needs its own sampling math and already has two variants (`textSdf`,
  `textSdfR8`). "One program" either branches or leaves the text tier separate;
  decide that before atlasing anything.

## Deliberately out of scope

**Skia-style op reordering** — hoisting a command past non-overlapping ones to
join an earlier batch. It needs per-command bounds plus an overlap structure,
and pays only when command kinds interleave. Steps 1–3 are larger and simpler.

## Two things to fix along the way

**The perf spec measures the wrong shape.** `tests/perf/draw-loop.spec.ts`
builds a flat command array, which is what let step 0 report a 1,400x win that
the app does not see. Add a scene-shaped variant — one wrapper group per
command, as `buildSceneTree` emits — or the numbers keep lying.

**Dispatch is half-deferred now.** `dispatch` walks the tree emitting GL inline,
except for rects, which defer; that is why every mutator now has to remember to
call `flushRects` first, and why "forgot a flush" is a silent wrong-order bug
rather than a crash. The coherent shape is two phases: walk once into a flat
list of draw items with resolved state, then group and emit. Steps 2–3 each add
another flush call site to the current design and each get simpler under the
split. Worth doing before step 3, not after.

## Verification

- `npm run test:visual` — 35 baselines. Order and clipping regressions show up
  as pixels; this is the gate that matters for every step here.
- `packages/core/src/renderer/rectBatch.test.ts` — 12 tests pinning each flush
  boundary against a GL recorder. Extend it per step rather than trusting the
  visual gate to catch an ordering slip.
- `npm run test:perf` — the draw-loop sweep, after the shape fix above.
- Pre-existing, not yours: `tests/e2e/bezier-edit.spec.ts` has 3 failures on
  clean `main`.
