# WebGL Transition — Roadmap

**Spec:** [`docs/superpowers/specs/2026-05-08-webgl-transition-plan-design.md`](../specs/2026-05-08-webgl-transition-plan-design.md)
**Architecture source:** [`docs/specs/2026-05-03-webgl-backend-design.md`](../../specs/2026-05-03-webgl-backend-design.md)

This roadmap is the index for the per-step implementation plans. The transition spec sequences the work in 10 steps; each step is its own plan written on demand (rather than batching all 10 plans up front). Plans are written for step N when step N−1 is shipped.

Why incremental: the granularity of step N's plan benefits from real lessons from step N−1. The spec explicitly chose the parallel-package strategy so each step is independently testable and abandonable, which makes incremental planning a natural fit.

**Required reading for every step plan:** [`webgl-stepwise-conventions.md`](./webgl-stepwise-conventions.md). Lessons accumulate there as steps ship; future-step plan authors must cite the doc in the plan header AND bake directly-applicable conventions into the relevant tasks inline (not just by reference). The doc itself is updated at the end of each step.

## Step index

| Step | Plan | Status | Scope summary |
|---|---|---|---|
| 1 | [`2026-05-08-webgl-step-1-solid-fill-paths.md`](./2026-05-08-webgl-step-1-solid-fill-paths.md) | **Shipped 2026-05-08** | Stand up `@orochi235/weasel-gl` workspace package. WebGL2 context lifecycle (creation, resize, DPR, loss/restore). Path tessellator (earcut for nonzero; stencil two-pass for evenodd; reuses existing `flattenCubic`/`flattenQuadratic`). Path mesh cache (WeakMap on Path identity). Built-in path-fill shader. DrawCommand interpreter for `kind: 'path'` with solid `Paint` only and `kind: 'group'` with transform + alpha. Smoke-test page in headless Chromium. |
| 2 | [`2026-05-09-webgl-step-2-strokes.md`](./2026-05-09-webgl-step-2-strokes.md) | **Shipped 2026-05-09** | **Strokes.** Ribbon-mesh expansion (CPU-side caps, joins, miter limits). Dash patterns via geometry gaps. Stroke uses the existing path-fill shader. Honor `StrokeAlign` (`center` / `inner` / `outer`; outer/inner via stencil for `PolygonPath`, via `alignedStrokeRect` for `RectPath`). |
| 3 | [`2026-05-09-webgl-step-3-text-msdf.md`](./2026-05-09-webgl-step-3-text-msdf.md) | **Shipped 2026-05-09** | **Text (MSDF).** Build pipeline (`pnpm gen:font` wrapping `msdf-bmfont-xml`). Default font ships prebuilt as JSON metrics + PNG atlas under `weasel-gl/fonts/`. SDF fragment shader. Glyph layout for ASCII + Latin-1 + CJK base. `registerFont(family, atlasUrl)` public API. |
| 4 | [`2026-05-09-webgl-step-4-image-pattern-gradient.md`](./2026-05-09-webgl-step-4-image-pattern-gradient.md) | **Shipped 2026-05-09** | **Image, pattern, gradient.** Image upload + cache. Pattern recreated from `CanvasPattern.image`. Linear/radial/conic gradient Paint variants via gradient-ramp texture (uploaded once per unique stop array, hashed). |
| 5 | [`2026-05-09-webgl-step-5-vertex-colors-and-color-matrix.md`](./2026-05-09-webgl-step-5-vertex-colors-and-color-matrix.md) | **Shipped 2026-05-09** | **Per-vertex colors + color matrix.** `kind: 'path'` `vertexColors` attribute honored by `pathFillVColor` shader variant. Group's `colorMatrix` applied as 4×5 row-major (mat4 + vec4 bias) uniform; composes through nested groups. |
| 6 | [`2026-05-09-webgl-step-6-experimental-shader-api.md`](./2026-05-09-webgl-step-6-experimental-shader-api.md) | **Shipped 2026-05-09** | **Minimal experimental shader API.** `registerProgram(id, vert, frag)` returning opaque `ShaderProgramHandle`. Uniform map (`number`, `vec2..4`, `mat3`, `mat4`, `texture`). Auto-generated quad geometry over `bounds`. Fixed vertex prelude exposing `v_uv` / `v_screen` / `v_world`. JSDoc `@experimental`. `registerTexture` for consumer-provided images. |
| 7 | [`2026-05-09-webgl-step-7-port-built-in-layers.md`](./2026-05-09-webgl-step-7-port-built-in-layers.md) | **Shipped 2026-05-09** | **Port built-in layers.** Additive `drawGL?` method on `RenderLayer`, plus `Dims` and `viewToMat3` helper. Eight built-in layers ported (`createPathLayer`, `createTextLayer`, `createGridLayer`, `createSelectionOverlayLayer`, `createCellHighlightLayer`, `createChildrenLayer`, `createPenPreviewLayer`, `createDebugOverlayLayer`). External signatures preserved. 2D `draw` unchanged through step 9; step 10 collapses to single `draw`. |
| 8 | [`2026-05-09-webgl-step-8-canvas-component-port.md`](./2026-05-09-webgl-step-8-canvas-component-port.md) | **Shipped 2026-05-09** | **Canvas component port.** `<Canvas>` / `<SceneCanvas>` accept `backend?: '2d' \| 'gl'`. Default `'2d'`. GL backend instantiates `WeaselRenderer` (lazy on first paint, disposed on unmount). `setupCanvasDpr` stays on the 2D path; GL uses `WeaselRenderer.resize`. New `drawLayersGL` dispatcher walks the layer list, warn-once for layers without `drawGL`. Warn-once on post-mount backend change. |
| 9 | [`2026-05-09-webgl-step-9-visual-regression-rig.md`](./2026-05-09-webgl-step-9-visual-regression-rig.md) | Plan written | **Visual regression rig + demo soak.** Playwright + pixelmatch, locked to `ubuntu-22.04` runner image. Per-pixel `threshold: 0.1`, pass criterion `< 0.02` mismatched. Capture per-demo baselines under `backend='2d'`. Switch demos to `'gl'` one at a time, iterate to ≤ 2% diff. Land baselines. Default `backend` flips to `'gl'` after all demos pass + 30 days at the published demo site without a regression bug. |
| 10 | _not yet written_ | Pending step 9 | **Final swap.** Delete 2D codepath (`paint.ts`, `setupCanvasDpr`, `useFixedPixelRatio`, `RenderLayer.draw(ctx, …)` 2D signature). Drop `backend` prop. Rename `@orochi235/weasel-gl` → fold into `@orochi235/weasel`. Major version bump. Migration guide + codemod for common consumer-RenderLayer patterns. Bundle-size delta documented. |

## Cross-cutting work that lives outside step plans

These are tracked here rather than wedged into a specific step plan, since they touch CI / repo-wide tooling and don't fit cleanly inside a single step's task graph.

| Concern | Where it lands |
|---|---|
| Bundle-size CI gate (fail PR if `weasel-gl` prod bundle delta > 50 KB without `CHANGELOG` entry) | Lands inside step 1 (the bundle exists from step 1 onward; gate it from day one). |
| Cross-browser smoke test matrix (Chrome / Firefox / Safari / Edge on macOS) | Lands inside step 1 as a manual checklist; automated only if friction warrants it. |
| `CONTRIBUTING.md` updates documenting the visual-regression CI image pinning | Lands inside step 9. |
| Migration guide + codemod for external consumer RenderLayers | Lands inside step 10. |

## Rollback by phase

Mirrored from the spec; restated here so it's visible from the roadmap.

- **Steps 1–7** (parallel package): full rollback available. Delete `packages/weasel-gl/`; `weasel` is untouched.
- **Steps 8–9** (soak): rollback = revert the `Canvas` PR; `weasel` returns to pre-port state. `weasel-gl` package can stay published or be deprecated.
- **Step 10** (final swap): no rollback. Major version bump publishes; consumers on the new major are committed. We commit to one round of patch backports on the previous major if a critical bug surfaces in the first 90 days post-swap, then EOL it.
