# Handoff — batched dispatch in the renderer

**Date:** 2026-08-14
**Branch:** `main`
**Landed:** `batch consecutive rect fills into one draw call` (`2604ce24`),
`break rect batches on group state, not tree shape` (`c2ebfdfe`),
`bake the rect batch's transform and alpha into its vertices`

What this is: the plan for getting the renderer's draw loop from one GL draw
call per command down to roughly one per frame, and the record of the steps that
have landed. Read it before touching `renderer/draw.ts`,
`renderer/rectBatch.ts`, or `canvas/buildSceneTree.ts`.

---

## Status

Steps 0–2 landed, and the win reaches the app. Consecutive solid-fill rects
merge into one `drawElements` through the existing `pathFillVColor` program,
with color on a vertex attribute and `u_color` held at white; a run survives any
group that does not actually change what a draw looks like; and transform and
alpha ride the vertices, so a per-node transform or opacity no longer breaks a
run at all. On an M2 Max via ANGLE at 800x600, 3,200 rects in the shape
`buildSceneTree` emits went 208.72 ms → 0.36 ms a frame, and 3,200 *rotated*
rects — a group with a transform per command, the shape `wrapNodeOutput` emits —
went 216.90 ms → 0.52 ms.

What still costs one draw call each: every command that is not a solid-fill
rect. A frame alternating solid and linear-gradient rects is unchanged at ~33 us
per command, almost all of it the gradient half. Steps 3–4 are about those.

Two barriers remain for rects. The clip stencil is a real GL state change. The
color matrix is a uniform still, deliberately — see step 2.

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

## Step 2 — bake state into the vertices (landed)

`RectBatch.push` takes the model matrix and maps the four corners itself, so the
flush draws at `u_model` identity and rects under different transforms share a
draw. An affine maps a rect to a parallelogram, so the two-triangle index
pattern still covers it. Group alpha multiplies into the vertex alpha the same
way fill opacity already did. Neither is in `StagedRectState` any more, and
neither breaks a run.

**The color matrix stayed a uniform, and stays a barrier.** The shader is
`mapped = clamp(CM * src + bias); a = mapped.a * u_alpha` — the matrix and the
clamp apply to straight-alpha `src` *before* the alpha multiply, so a
pre-multiplied vertex alpha is only the same number while `CM` is identity, and
applying the matrix CPU-side means reproducing that clamp exactly or watching
colors drift wherever a channel goes out of range. Since `CM` is identity in
every scene that does not use one, a barrier on it costs nothing real. So
`pushRect` folds alpha only under an identity matrix and leaves `u_alpha` a
uniform otherwise; `rectBatch.test.ts` pins both halves.

The `u_model` second-writer hazard did not materialize: the batch goes through
`setProjAndModel` like every other writer, so the per-program cache still sees
every value it holds. Bypassing it with a raw `uniformMatrix3fv` is what would
break it.

CPU transform is float64 where the GPU was float32, which was expected to be
equal-or-better and to be worth checking rather than assuming: all 35 visual
baselines passed untouched.

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
- `npm run test:perf` — the draw-loop sweep, whose `scene` and `rotated`
  variants are the shapes the app renders (`buildSceneTree`'s wrapper group per
  node, and `wrapNodeOutput`'s transform group for a rotated one). Read a cell
  against its neighbours: one cell in the sweep
  used to come back 30x slow from a collection landing inside the timed block,
  which is why each cell now times two blocks and reports the second, collects
  between blocks, and measures `alternating` last.
- **Run one Playwright suite at a time.** Two concurrent runs share
  `test-results/` and delete each other's artifacts mid-run; it surfaces as a
  timeout plus `ENOENT ... .trace`, not as anything about the code.
- Pre-existing, not yours: `tests/e2e/bezier-edit.spec.ts` has 3 failures on
  clean `main`.
