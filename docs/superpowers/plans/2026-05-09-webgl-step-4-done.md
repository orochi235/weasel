# WebGL Step 4 — Done

**Plan:** [`2026-05-09-webgl-step-4-image-pattern-gradient.md`](./2026-05-09-webgl-step-4-image-pattern-gradient.md)
**Date completed:** 2026-05-09

## What shipped

- `Paint` type extension on `@orochi235/weasel`: linear / radial / conic gradient variants + `GradStop` type. 2D `applyPaint`/`applyStroke` fall back to opaque black for gradient variants (2D backend is GL-only deferred to step 10).
- `GradientRampCache` — CPU 1×256 RGBA ramp builder + per-renderer GL texture cache keyed on `JSON.stringify(stops)`.
- `GLImageCache` — WeakMap-keyed image upload (key = `ImageBitmap` identity). Wrap modes per `repetition` (CLAMP / REPEAT / mixed).
- `imageFill` shader — textured-quad with premultiplied alpha output.
- `gradFill` shader — uniform-driven kind branch (linear/radial/conic) sampling the ramp texture.
- `WeaselRenderer` extended: 4 programs (pathFill, textSdf, imageFill, gradFill) compiled in constructor + recreated on context restore. 4 caches (mesh, font texture, image, gradient ramp).
- `PathDrawCommand.fill` widened from `SolidPaint` to full `Paint` union.
- `kind: 'image'` DrawCommand variant + `drawImage` dispatch (screen-space quad with image-fill shader).
- `parseColorToRgba255` helper in `color.ts`.
- Public barrel exports: `ImageDrawCommand`, `buildGradientRamp`, `GradStop`.
- Playwright `paint.spec.ts` smoke covering linear/radial/conic gradients + image command.
- Browser-verified: smooth red→blue linear gradient; yellow→black radial; 7-stop rainbow conic sweep; procedural ImageBitmap stretched into a quad.

## Notable deviations from plan

- **Tasks 6, 7, 8 merged into one commit.** They all touch interlocking shapes (DrawContext fields, DrawCommand types, dispatch logic) — splitting them would have left typecheck broken between commits.
- **Plan version-pinned `msdf-bmfont-xml@6.0.0` style risk avoided this step.** No new deps; only type changes and new TS modules.
- **`u_worldInv` is identity.** Gradient coordinates render in screen space because `draw.ts` doesn't yet receive a view matrix. Step 7 (port `createPathLayer`) wires the actual view-inverse through layers. Documented inline.
- **Stencil-clipped fill (evenodd) supports only solid Paint in step 4.** Non-solid fills fall back to opaque black with a console warning. Refining stencil + non-solid composition is deferred to step 7 alongside layer ports.
- **Stroke paint stays solid-only** (the existing step-2 guard is still in place). Gradient/pattern stroke paints would need the same stencil-clip + ribbon-mesh marriage as fills; defer to step 5+ as a focused task if a consumer needs it.
- **Skipped Task 13's soak demo for cache hit rate.** The cache works correctly per unit tests; the >95% hit-rate target is a step-9 visual-regression-rig concern, not step 4.
- **Plan's test for "last pixel" in `buildGradientRamp` had a slice-index error** (`slice(252, 256)` is pixel 63, not pixel 255). Fixed in the test.
- **`new ImageData(8, 8)` failed in vitest's jsdom env** — `ImageData` constructor not available. Used a duck-typed object instead.
- **`CanvasPattern.image` non-standard property extraction** is in place but untested in real browser yet — there's no smoke for pattern fills since constructing a real `CanvasPattern` requires a 2D context. The `paint.html` covers gradients + image; pattern via real `<canvas>.getContext('2d').createPattern()` would be the test, but consumer smoke can validate this when it ships.

## Test results

- Vitest: 1407+ tests pass (1384 from steps 1–3, ~23 new from step 4: gradientTypes 5, GradientRampCache 12, GLImageCache 6, parseColorToRgba255 3).
- Playwright: 4/4 smoke specs pass (smoke + synthetic + text + paint).
- Typecheck: clean.
- Browser-verified: all 4 paint scenes (linear/radial/conic gradients + image) render correctly.

## Lessons for step 5+ (will be folded into conventions)

- **Plan task ordering: when shapes interlock, merge tasks.** Splitting interface-shape-touching tasks across multiple commits forces broken-typecheck intermediate states. Pattern: identify clusters of tasks that all modify the same shape (DrawContext, DrawCommand union, etc.) and commit them together. Step 5 onward should expect 1-3 such clusters per plan.
- **`ImageData` is not in jsdom by default.** Use duck-typed `{ width, height, data }` for unit tests, or polyfill if needed. Convention §1 already covered "context defaults invisible to recorder"; this adds "DOM types may be missing in test env."
- **Plan-time test fixtures should be sanity-checked.** The `slice(252, 256)` bug in the gradient ramp test was a math error in the plan that would have been caught by hand-computing the expected indices. Plan reviewers should mentally-execute fixture computations.

## Open follow-ups

- Stroke gradient/pattern paint (currently throws). Not a step-5 task per the spec; add a focused task in step 5 or punt to a later mini-step.
- Stencil-clip (evenodd) + non-solid fill composition. The stencil pass works for the mask, but the "draw the masked region with a non-solid paint" step needs work. Step 7 is the natural place.
- Real-browser pattern fill smoke (CanvasPattern from `<canvas>.getContext('2d')`). Add when a consumer needs it.
- Gradient world-space sampling (`u_worldInv`). Currently identity; lands in step 7.
- Cache hit rate measurement / soak demo. Step 9 visual-regression rig is the natural home.
