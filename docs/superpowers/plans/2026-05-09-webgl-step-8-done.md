# WebGL Step 8 — Done

**Plan:** [`2026-05-09-webgl-step-8-canvas-component-port.md`](./2026-05-09-webgl-step-8-canvas-component-port.md)
**Date completed:** 2026-05-09

## What shipped

- **`<Canvas>` and `<SceneCanvas>` accept `backend?: '2d' | 'gl'`.** Default stays `'2d'` through step 9's soak. The prop is read once at mount; post-mount changes log a warn-once and are no-ops.
- **`drawLayersGL(layers, data, visibility, order, view, dims): DrawCommand[]`** in `src/core/layers/render.ts` — sibling to the 2D `drawLayers`. Mirrors visibility/order resolution; iterates and concatenates each layer's `drawGL(data, view, dims)`. Layers without `drawGL` warn-once per layer id (module-level Set) and are skipped.
- **`<Canvas>` GL backend lifecycle**: lazy-creates `WeaselRenderer` on first paint when `backend === 'gl'`; disposes on unmount. The `<canvas>` element gets `getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })` automatically — consumers don't pass these.
- **DPR branching**: 2D path keeps `setupCanvasDpr` from `src/features/viewport/pixelDensity.ts`. GL path calls `WeaselRenderer.resize({ width, height, dpr })` only when dims/dpr change (tracked via `lastResizeRef`). No unified DPR helper — the two paths stay independent.
- **Cross-package alias audit (convention §14)**: top-level `vite.config.ts` and `apps/swillustrator/vite.config.ts` were missing the `@orochi235/weasel-gl` alias. Without these, every demo + swill page would have broken on the first `Canvas.tsx → @orochi235/weasel-gl` import. Caught preemptively; fixed in `ac8e573`.
- **Smoke dev page** `packages/weasel-gl/dev/canvas-gl.{html,tsx}` rendering `<SceneCanvas backend="gl">` with grid + cell highlight + a path layer. Playwright `canvas-gl.spec.ts` (4 specs): center-of-rect non-empty, blue rect, outside-bounds transparent, 16×16 grid scan ≥ 30 painted samples.

## Notable deviations from plan

- **jsdom guard for `<Canvas backend="gl">`**: the plan said early-return on `!gl`. In practice, jsdom's `getContext` mock returns a non-null 2D-shaped stub even when called with `'webgl2'`. The implementer added a `typeof gl.enable === 'function'` runtime check + try/catch around `new WeaselRenderer({...})` so the GL branch doesn't crash unit tests. Filed in commit `0e6e072`.
- **Playwright `testMatch` regex**: plan didn't mention adding `canvas-gl` to the regex. Implementer added it; trivial.
- **`lastResizeRef` for resize gating**: not strictly in the plan, but necessary to avoid re-binding the WebGL viewport on every render. Tracks last `{width, height, dpr}` and only calls `WeaselRenderer.resize` when one of those changes.
- **System-layer `drawGL` gap (KNOWN FOLLOW-UP)**: `SceneCanvas` injects `preview-ghost` and `select-overlay` system layers (separate from the user-supplied layers list). Neither has been ported to `drawGL`. Under `backend='gl'` they warn-once and skip — meaning **selection ghosts and selection overlays are invisible under the GL backend right now**. The dev smoke page exhibits this: console shows two warn-once messages on first paint. Step 9's soak will need either (a) these system layers ported, or (b) the soak demos chosen to not exercise them, or (c) the warn-skip path documented as a known gap consumers can opt into. Filed as the highest-priority follow-up below.

## Test results

- **Vitest: 1476/1476 pass** (180 test files; +16 from step 7's 1460).
- **Playwright: 17/17 specs pass** (smoke + synthetic + text + paint + colors + 3 shader + 5 layers + 4 canvas-gl).
- **Typecheck**: only the pre-existing `draw.ts(138,84)` warning, unchanged from step 7.
- **Browser-verified**: `/packages/weasel-gl/dev/canvas-gl.html` shows the GL-backend `<SceneCanvas>` rendering grid + cell highlight + path layer; the two warn-once messages for system layers fire exactly once per page load (not per frame).

## Lessons for step 9+ (folded into conventions)

- **§14 strengthened**: when a port crosses a package boundary, audit *every* `vite.config.ts` and `vitest.config.ts` in the repo, including app-level configs (`apps/*/vite.config.ts`). The dev vite config is necessary but not sufficient — top-level + app-level configs serve real consumer pages and demos.
- **§16 (new): React lifecycle gotchas under jsdom for GL contexts.** `getContext('webgl2')` returns a 2D-shaped mock under jsdom (it lies about supporting WebGL2), so unit tests that mount `<Canvas backend='gl'>` need a duck-type runtime check (`typeof gl.enable === 'function'`) before assuming the context is real. The "real" check is the playwright smoke; jsdom unit tests can verify wiring (refs, effects, dispose) but not GL semantics.

## Open follow-ups

- **PRIORITY: port `preview-ghost` and `select-overlay` system layers to `drawGL`.** These are inside `SceneCanvas`, not in user-supplied layer arrays, so they weren't part of step 7's port list. Step 9's soak cannot replicate selection visuals under the GL backend until these ship.
- **`lastResizeRef` could be combined with the existing 2D resize observer** — minor refactor opportunity in step 10 when the 2D path is deleted.
- **Pre-existing `draw.ts(138,84)` typecheck warning** still standing — clean up in step 10.
- **`<Canvas>` is 1055 lines.** It works, but is a candidate for a future refactor when the 2D path is deleted. Step 10's swap will halve it; further decomposition is a follow-up.
