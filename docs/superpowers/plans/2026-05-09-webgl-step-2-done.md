# WebGL Step 2 — Done

**Plan:** [`2026-05-09-webgl-step-2-strokes.md`](./2026-05-09-webgl-step-2-strokes.md)
**Date completed:** 2026-05-09

## What shipped

- Public exports of `StrokeAlign` type and `alignedStrokeRect` helper from `@weasel-js/core`.
- `extractPolylines(path)` — walks a `Path`, flattens curves via existing `flattenCubic`/`flattenQuadratic`, emits one polyline per contour with `closed` flag.
- `tessellateStroke(path, stroke, opts)` produces a triangle ribbon mesh:
  - Straight-segment ribbon expansion (perpendicular ± half-width per side)
  - Bevel joins (single triangle through joint center)
  - Miter joins (line-line intersection apex + inner bevel half — TWO triangles)
  - Miter limit fallback (Canvas2D-default 10× half-width; falls back to bevel)
  - Round joins (fan triangulation at ~10° per step, pivot at joint)
  - Square + round end caps (open polylines only)
  - Dash patterns (`splitForDash` slices polyline into per-on-segment ribbons)
- `kind: 'path'` DrawCommand variant gains `stroke?: Stroke`. `drawPath` draws fill first (existing) then stroke (new). Reuses the path-fill shader from step 1 (no new shader needed — strokes are colored triangles).
- `RectPath` inner/outer alignment via `alignedStrokeRect` (alignment baked into geometry; no stencil).
- `PolygonPath` inner/outer alignment via stencil two-pass (pass 1 builds path-interior mask from fill triangulation, pass 2 draws doubled-width ribbon clipped to the desired side).
- `tessellateStroke` exported from `@weasel-js/gl` public barrel.
- Synthetic scene canvases for caps / joins / dash / align — added to existing dev page; covered by the existing Playwright synthetic spec.

## Notable deviations from plan

- **Plan's miter implementation was a single triangle** `(R1, apex, R0)` reused as the join. Actual implementation needed **TWO triangles** to fill the kite-quadrilateral `(R1, apex, R0, J)`; without the inner bevel half, every miter corner showed an "inverted triangle" gap. The plan's pseudocode had this bug; caught only after browser-eyeballing the cAlign and cJoins canvases. Conventions §1 (mock GL hides geometry coverage) almost — but not quite — covered this; the recorder catches *what* draw calls are made, not *what area* the resulting triangles cover. Adding a new convention entry (see below).
- **Round-join sweep-direction conditions were inverted** in the plan. Forced the long 270° arc instead of the short 90° outer-wedge arc. Same kind of bug — passed unit tests (which only check triangle count, not vertex positions).
- **Test geometry for "miter falls back to bevel for very acute angles" was wrong** in the plan — used 5° bend (= 175° interior angle = obtuse, miter tiny) instead of an actually-acute corner. Old single-triangle implementation passed by coincidence (always 1 join triangle either way). Updated to a near-U-turn that actually triggers fallback.
- Bevel join implementation deviated from the plan's `innerCorner`-based pseudocode. Used a fresh joint vertex `J` as the third triangle vertex — cleaner, no overdraw at translucent corners. Worked first try.
- Plan's miter math used a sketch with a `// not in scope; pass via param` placeholder; the cleaner `emitMiterOrBevel` helper in the second half of the task was used instead.

## Test results

- Vitest: 1358/1358 tests pass (1332 from step 1 + 26 new from step 2 — stroke 15, polyline 5, draw-stroke 6).
- Playwright smoke: 2/2 specs pass against headless Chromium (existing smoke + 4 new synthetic canvases auto-covered by the existing scene-paints-non-empty-pixels assertion).
- Typecheck: clean.
- Browser-verified: caps render distinct, joins render correctly (no notches), dash patterns visible, all three rect alignments correct, polygon stencil-clip contains the stroke.

## Lessons for step 3 (text via MSDF) and beyond

These will be folded into `webgl-stepwise-conventions.md`:

- **Plan-time geometry pseudocode is risky.** Step 2's miter and round join code in the plan had subtle bugs (single triangle when two were needed; inverted sweep-direction conditions). The bugs passed unit tests because tests asserted triangle counts, not areas of coverage. The browser smoke caught them. **Implication:** for any future task with non-trivial geometry, plan code should be treated as a starting sketch, not a verbatim spec — and the implementer should derive the math from first principles when writing the implementation, then cross-check against the plan.
- **Mock-GL recorder has another blind spot.** Beyond convention §1 (context attributes), it also can't catch geometry coverage bugs. Triangles drawn in the wrong shape, in the wrong winding order, or missing entirely (when extra triangles needed) all pass the recorder's "did the right calls happen" assertion. **Add a new convention §8** to capture this.
- **Test cases for boundary behavior need to be checked carefully.** The "miter falls back" test had wrong geometry and passed only by accident. When writing TDD tests for thresholds (miter limit, miter-vs-fallback, etc.), verify the test case actually crosses the threshold by computing the expected value by hand.
- **Reusing the path-fill shader for strokes works.** No need for a separate stroke shader. Step 4 (gradient/pattern) will need a new fragment shader; the convention from §2 (premultiplied alpha) still applies.

## Open follow-ups

- The current miter limit (10) is hardcoded as `MITER_LIMIT` in `stroke.ts`. The `Stroke` type doesn't have a `miterLimit` field; adding one would be a public-API change. Defer until a real consumer needs it.
- For self-intersecting paths with `inner/outer` alignment, the stencil two-pass uses the path's own fill triangulation. For `nonzero` self-intersection, this is correct (earcut respects winding). For `evenodd` self-intersection, the mask uses the naive fan + already-set `requiresStencil`, which doesn't compose with stroke's stencil pass cleanly. Defer.
- Stroke-mesh caching (per `(Path, Stroke)` tuple) is NOT implemented. Each draw recomputes. Add caching in step 9 if profiling shows it matters.
- `cAlign` polygon scene shows the trapezoid stroke clipped inside the polygon — works visually. But the stencil-clipped stroke is conceptually fragile for paths whose fill mesh has `requiresStencil: true` (evenodd multi-contour). Out of scope; flagged.
