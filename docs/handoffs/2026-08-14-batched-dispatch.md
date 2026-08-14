# Handoff — batched dispatch in the renderer

**Date:** 2026-08-14
**Branch:** `main`
**Landed:** `batch consecutive rect fills into one draw call` (`2604ce24`),
`break rect batches on state, not on structure`

What this is: the plan for getting the renderer's draw loop from one GL draw
call per command down to roughly one per frame, and the record of the two steps
that have landed. Read it before touching `renderer/draw.ts`,
`renderer/rectBatch.ts`, or `canvas/buildSceneTree.ts`.

---

## Status

Steps 0 and 1 landed, and the win now reaches the app. Consecutive solid-fill
rects merge into one `drawElements` through the existing `pathFillVColor`
program, with color on a vertex attribute and `u_color` held at white, and a run
survives any group that does not actually change what a draw looks like. On an
M2 Max via ANGLE at 800x600, 3,200 rects in the shape `buildSceneTree` emits
went 208.72 ms → 0.36 ms a frame, which is what the same rects cost flat.

What still costs one draw call each: every command that is not a solid-fill
rect. A frame alternating solid and linear-gradient rects is unchanged at ~33 us
per command, almost all of it the gradient half. Steps 2–4 are about those.

The barrier that remains for rects is the clip stencil, which is a real GL state
change. Transform, alpha, and color matrix are still barriers too, but only
because they are uniforms — step 2 moves them onto the vertices and they stop
being barriers at all.

## Step 1 — break on state, not on structure (landed)

Dispatch used **structural boundaries as a proxy for state changes**: a group
was a barrier because it *might* move a uniform. One level down, `draw.ts`
already answered that question honestly — `UploadedUniforms` + `sameValues` skip
an upload when the value did not change — and the batch now breaks on the same
test. `DrawContext.rectState` holds the `(transform, alpha, colorMatrix,
clipDepth)` a run was staged under; `pushRect` flushes when the live state
differs, and `flushRects` draws with the staged values rather than whatever is
live when it happens.

That last part is what lets a run outlive the group it started in: the group is
long since popped by the time the following rect breaks the run, and its
transform has to come from the staging record or the pixels move.

Invariants to keep:

- **Compare by value, not by reference.** Reference equality catches the no-op
  group, but a group carrying an identity-valued transform goes through
  `mat3.multiply`, which allocates a new array with equal values.
- **Clip changes are hard flush points, in both directions.** `pushClip` /
  `popClip` rasterize into the stencil buffer, which staged values cannot
  reconstruct. `drawGroup` flushes *before* mutating `clipDepth`, not after
  noticing it changed — a run that survived past `popClip` would paint pixels
  that belonged inside the clip with the mask already torn down.
- `dispatch` keeps flushing before text, image, and shader commands. Those bind
  other programs and the state test says nothing about that.

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

## One thing to fix along the way

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
- `packages/core/src/renderer/rectBatch.test.ts` — 14 tests pinning each flush
  boundary against a GL recorder. Extend it per step rather than trusting the
  visual gate to catch an ordering slip.
- `npm run test:perf` — the draw-loop sweep, whose `scene` variant is the shape
  the app renders. Read a cell against its neighbours: one cell in the sweep
  used to come back 30x slow from a collection landing inside the timed block,
  which is why each cell now times two blocks and reports the second, collects
  between blocks, and measures `alternating` last.
- **Run one Playwright suite at a time.** Two concurrent runs share
  `test-results/` and delete each other's artifacts mid-run; it surfaces as a
  timeout plus `ENOENT ... .trace`, not as anything about the code.
- Pre-existing, not yours: `tests/e2e/bezier-edit.spec.ts` has 3 failures on
  clean `main`.
