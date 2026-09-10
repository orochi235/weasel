# Handoff — batched dispatch in the renderer

**Date:** 2026-08-14
**Branch:** `main`
**Landed:** `batch consecutive rect fills into one draw call` (`2604ce24`),
`break rect batches on group state, not tree shape` (`c2ebfdfe`),
`bake the rect batch's transform and alpha into its vertices` (`d62dc172`),
`batch solid-fill meshes and stroke ribbons alongside rects`,
`cache tessellated stroke ribbons by path identity` (`1ad733a3`)

What this is: the plan for getting the renderer's draw loop from one GL draw
call per command down to roughly one per frame, and the record of the steps that
have landed. Read it before touching `renderer/draw.ts`,
`renderer/drawBatch.ts`, or `canvas/buildSceneTree.ts`.

---

## Status

Steps 0–3 landed, and step 4's text half with them; gradients are what is left
of it. **This file stops there and is not the current record.** The
flush work it describes as open was finished afterwards — the solid batch cycles
a buffer ring instead of rewriting one pair (`12303bc0`) and skips uploads the
GPU already has (`da7c1505`), taking a solid boundary from 27 us to 2.5 us.
`docs/TODO.md` under "Release-gate & build hygiene" carries what is left.
Image quads joined the solid batch on 2026-09-09 and `solidBatch.ts` is now
`drawBatch.ts`; step 4 below is the only part of this plan still open.

Steps 0–3 as landed: Consecutive solid-fill geometry — rects, tessellated fills,
stroke ribbons — merges into one `drawElements` through the existing
`pathFillVColor` program, with color on a vertex attribute and `u_color` held at
white. A run survives any group that does not change what a draw looks like, and
transform and alpha ride the vertices, so a per-node transform or opacity does
not break one at all. Frame cost at 800x600 on an M2 Max via ANGLE, before this
work and after:

| 3,200 commands | before | after |
|---|---|---|
| scene-shaped rects (`buildSceneTree`'s wrapper group each) | 208.72 ms | 0.39 ms |
| rotated rects (`wrapNodeOutput`'s transform group each) | 216.90 ms | 0.70 ms |
| solid-fill octagons | 5.63 ms | 0.65 ms |
| stroked rects (fill + ribbon) | 243.80 ms | 1.7–2.0 ms |

What still costs one draw each: gradients, patterns, images, text, shaders,
per-vertex-color fills, stencil fills, and meshes past the batch's vertex cap. A
frame alternating solid and linear-gradient rects is unchanged at ~33 us per
command, almost all of it the gradient half. Step 4 is about those.

The stroked figure includes the ribbon cache added 2026-08-15: batching alone
left it at 9.41 ms, ~85% of which was stroke tessellation, and caching that on
`Path` identity took it to 1.7–2.0 ms. Read the magnitude, not the digits —
the two runs behind that range also moved the untouched `alternating` variant
101 -> 152 ms, so this laptop's noise floor is wider than the spread.

Two barriers remain. The clip stencil is a real GL state change, and the color
matrix is deliberately still a uniform — see step 2.

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

## Step 3 — batch solid-fill meshes, not just rects (landed)

`RectBatch` became `SolidBatch` with a `pushMesh` alongside `pushRect`: append
transformed vertices, per-vertex color, and indices rebased by `+vertexBase`.
Solid path fills and solid stroke ribbons both take that route, so a stroked
shape's fill and stroke land in the same draw — GL rasterizes a draw's
primitives in index order, which is what keeps the stroke on top.

Excluded: stencil fills (`requiresStencil`, and the inner/outer-aligned stroke's
two-pass dance), anything carrying `vertexColors`, and meshes past
`MAX_BATCHED_MESH_VERTICES`. That last one is the thing this step gives up —
batching re-copies and re-uploads a mesh every frame where a cached
`GLMeshHandle` costs nothing per frame beyond the draw, so above break-even a
big path is better off with its own draw. `getMesh` is untouched either way; it
caches the tessellated `Mesh` by `Path` identity and only the GPU-side upload
moves.

### What the measurement actually said

The recorded conclusion this plan was built on — a flat ~66 us per draw call —
was wrong, and reading it as "draw calls are expensive" points at the wrong
work. Per the sweep on an M2 Max via ANGLE:

- A **warm** mesh draw (persistent VAO, nothing touched between draws) is
  ~1.8 us, and that number includes this fixture's heavy overdraw.
- A **stroked** command was ~76 us. Of 243.80 ms for 3,200 of them, tessellation
  is 7.9 ms and creating and freeing the transient VAO plus two buffers is
  ~16 ms. The remaining ~220 ms is issuing draws *against buffers minted that
  frame* — the driver cannot pipeline over a buffer it has just been handed.

So the cost is touching buffers between draws, not the draws. That is why
batching pays: it moves every buffer write to once per frame. Post-batching,
3,200 stroked commands are 9.41 ms, of which 7.9 ms is the tessellation that
batching does not address — which is what the ribbon cache below went after.

Rects paid a little for it: the index buffer stopped being a static pattern
written once and became a per-flush upload, costing ~0.1 ms per frame at 3,200
rects. Left alone deliberately — a static-index fast path for all-rect runs is
complexity against a tenth of a millisecond.

### Step 3a — cache the ribbons (landed 2026-08-15)

`cache/strokeMeshCache.ts` keys tessellated ribbons on `Path` identity crossed
with the parameters that change the geometry, taking 3,200 stroked commands
from 9.41 ms to 1.7–2.0 ms. The eviction story that held this back is a gate
rather than a policy: a ribbon earns a persistent GL handle only on its *second*
sight, so a path whose geometry animates mints a new `Path` every frame, never
reaches promotion, and keeps the transient upload that is freed at end of
frame. Promotion costs one extra upload, because `uploadTransient` does not
populate the persistent map — steady state starts on the third frame.

**The gate belongs to `GLMeshCache`, not to the ribbon cache**, and putting it
in the wrong place is a live bug rather than a style question. The ribbon cache
is module-global while `GLMeshCache` is per-renderer, so a cache-wide "seen"
flag tells a second renderer — a `SceneViewCanvas` minimap, a
`renderSceneToPixels` export — that a mesh *its own context never uploaded* is
safe to make persistent. `GLMeshCache.uploadRecurring` owns it against a
per-context `WeakSet`. Vertex-colored strokes are excluded and stay transient:
their per-draw color VBO and enabled `a_vertexColor` array are recorded into
the VAO, and `vertexColors` is not in the cache key. Design:
`docs/superpowers/specs/2026-08-15-stroke-ribbon-cache-design.md`.

## Step 4 — one program and atlases

Gradients bind a ramp texture per draw, images a texture, text an atlas page.
Ramps are 1D and atlas into rows of one texture; images go in a texture array;
paint parameters ride per-vertex. Then a frame is one program and near-one draw.
This is a paint-path rewrite — the direction, not a next step.

**The ramp atlas landed on 2026-09-10.** `cache/GradientRampAtlas.ts` holds
every baked ramp in rows of one texture and `gradFill` picks its row with
`u_rampV`, so a gradient no longer owns a texture. Gradients still bind their
own program and still break the run — what the atlas buys is that when they
stop, all of them fit in one slot instead of one slot each.

**Linear gradients joined the batch the same day.** A linear gradient's ramp
position is affine in position, so a vertex can carry it and the rasterizer's
interpolation across a triangle is exact — which makes such a fill a textured
quad off the ramp atlas and nothing else. It rides the plain paint mode with
`a_uv = (ramp position, row)`, white vertices carrying its opacity, and adds no
paint mode, no vertex float and no line of shader. The atlas takes one slot for
every gradient in the run, so a page of them is one draw.

The trap that shape carries: a staged vertex names its row by where the row
sits, so an atlas that grows — every `v` moves — or recycles a row repaints
geometry already staged. `wouldReshape` is asked before the bake and the run is
flushed if the answer is yes; asking afterwards is too late, because neither can
be undone.

**Radial and conic followed the same day, and step 4 is closed.** Their ramp
position is not affine, but the *coordinate* they need is, so a vertex carries a
gradient-space point in `a_uv` and its atlas row in `a_post`, and the shader
takes a `length` or an `atan` of it.

Both sit behind a branch on the paint mode. That is legal where a branch around
the glyph math is not: the mode is a flat varying, so every fragment of a quad
takes the same arm, and neither arm holds a derivative — which is the only thing
non-uniform control flow breaks.

**The branch has to carry the sample, not just the coordinate.** Selecting a uv
and then sampling once leaves every fragment in the program reading a texture at
a coordinate the shader computed, which the hardware cannot schedule the way it
schedules a read from a varying. Against the same shader with no branch at all,
that costs 65.1% of a fragment; splitting the fetch across the two arms, so the
common one still reads `v_uv`, costs 4.9%. Both from
`tests/perf/fill-rate.spec.ts` in one sitting.

**Text branched, and landed on 2026-09-09.** It does not stay separate: the
batch shader runs the glyph math — a median across three channels, `fwidth`, a
smoothstep — on *every* fragment, because `fwidth` inside non-uniform control
flow is undefined and the derivative must be taken before anything selects on
paint mode. Priced head to head at 432M fragments a frame
(`tests/perf/fill-rate.spec.ts`) that roughly *doubles* a fragment that is not
a glyph.

**That figure was first recorded as 1.4%, and it was wrong.** The variant meant
to carry the glyph math gated it on `u_color.a * 0.0`, which a compiler folds
to zero and then deletes every line feeding — so the measurement compared
`plain` against `plain`. A runtime zero that is not a compile-time one is what
keeps the code alive. The conclusion survives the correction, because a wall is
draw-bound and not fill-bound, but a fill-heavy scene pays more for text than
this plan said it did.

The cost that turned out to matter was the vertex, and it is paid rather than
absorbed: a paint mode carried as a float of its own measured 9% slower at the
densest rung of `tests/perf/atlas-wall.spec.ts`. Slot and mode are both small
enumerations, so they share `a_texSlot` as `slot + 8 * mode`, and the
synthetic-bold threshold stayed a uniform — which breaks a run where a faked
bold meets text that is not. `docs/TODO.md` carries the numbers.

Traps, all of which held:

- **Never mipmap the MSDF atlas.** Filtering a distance field destroys it. Keep
  the text atlas out of any shared image atlas rather than trusting a flag on
  `GLTextureCache`.
- Two sampling maths, not one: an MSDF atlas takes the median of RGB and the
  runtime canvas bake reads `.r`. Both are cheap and both are
  derivative-dependent, so the merged shader selects between them with a `mix`
  and takes `fwidth` of the result — outside any branch.
- Synthetic italic already skews on the CPU in `drawText`, and the batch places
  its own corners, so the skew rides the vertices for free — `pushGlyph` shears
  them as it places them.

## Deliberately out of scope

**Skia-style op reordering** — hoisting a command past non-overlapping ones to
join an earlier batch. It needs per-command bounds plus an overlap structure,
and pays only when command kinds interleave. Steps 1–3 are larger and simpler.

## One thing to fix along the way

**Dispatch is half-deferred.** `dispatch` walks the tree emitting GL inline,
except for solid geometry, which defers; that is why every mutator has to
remember to call `flushSolids` first, and why "forgot a flush" is a silent
wrong-order bug rather than a crash. The coherent shape is two phases: walk once
into a flat list of draw items with resolved state, then group and emit.

Steps 2 and 3 were expected to make this worse and did not — both *removed*
flush sites (transform and alpha stopped being barriers; batched strokes stopped
flushing). The remaining sites are text, image, shader, non-batchable fills,
stencil strokes, and the clip pushes. So this is now a clarity argument rather
than a pressure one, and step 4 is where it starts paying.

## Verification

- `npm run test:visual` — 35 baselines. Order and clipping regressions show up
  as pixels; this is the gate that matters for every step here.
- `packages/core/src/renderer/drawBatch.test.ts` — 32 tests pinning each flush
  boundary, and the buffers a flush writes, against a GL recorder. Extend it per step rather than trusting the
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
