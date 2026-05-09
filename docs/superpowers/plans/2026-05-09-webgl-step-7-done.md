# WebGL Step 7 — Done

**Plan:** [`2026-05-09-webgl-step-7-port-built-in-layers.md`](./2026-05-09-webgl-step-7-port-built-in-layers.md)
**Date completed:** 2026-05-09

## What shipped

- **`RenderLayer<TData>` gained an additive `drawGL?(data, view, dims): DrawCommand[]` method** plus a new `Dims` type. The 2D `draw` is unchanged through step 9; `drawLayers` ignores `drawGL` (asserted by a unit test). Step 8's `<Canvas>` port will dispatch it; step 10 deletes the 2D path and renames `drawGL → draw`.
- **`viewToMat3(view): Mat3` helper exported from `@orochi235/weasel-gl`.** World-space layers wrap their `drawGL` output in `kind: 'group'` with this transform. Local `View`-shaped type (re-exported as `ViewLike`) avoids a runtime cross-package import.
- **Eight built-in layers ported** — additive `drawGL` next to existing `draw`:
  - `createPathLayer` — one path command per visible node, wrapped in world-transform group.
  - `createTextLayer` — one text command per wrapped line; offscreen-2D ctx fallback for `measureText` (with a duck-typed stub for jsdom).
  - `createGridLayer` — sub/cell/accent line bands as polygon paths; stroke widths divided by `view.scale` so they render hairline regardless of zoom.
  - `createCellHighlightLayer` — one rect path command.
  - `createChildrenLayer` — aggregates a new optional `drawChildGL` callback in z-order. Returns `[]` when consumer doesn't supply the GL counterpart.
  - `createSelectionOverlayLayer` (+ outline / handles variants) — three factories ported via `outlineCommandsFor` / `handleCommandsFor` / `rotationHandleCommands` GL helpers that mirror the existing 2D internals.
  - `createPenPreviewLayer` — subpaths, anchors (circle approximations), handles, rubber-band, close-hint ring.
  - `createDebugOverlayLayer` — hitboxes, bounds, handles, origin marker, snap targets, layer-list panel anchored to `dims.width` (right edge).
- **`viewToMat3` + 5 unit tests** for the helper.
- **Dev `vite.config.ts` aliased `@orochi235/weasel-gl`** so dev pages can serve the browser through main `src/index.ts → pathLayer.ts → @orochi235/weasel-gl` without bare-specifier failures. (See "Notable deviations.")
- **Smoke scene** `dev/layers.{html,ts}` composing `createGridLayer + createCellHighlightLayer + createPathLayer` via their `drawGL` outputs into `WeaselRenderer.render`. 5 Playwright assertions: red rect center, blue rect center, cell highlight tint, outside-bounds transparent, 16×16 grid scan ≥30 painted.

## Notable deviations from plan

- **Dev vite alias is required, not optional.** The plan listed it under task 11 but didn't flag it as a blocker. In practice, the moment `src/features/paths/pathLayer.ts` started importing `@orochi235/weasel-gl`, *every* dev page (including pre-existing `smoke.ts`, `colors.ts`, etc.) broke in the browser — the chain `weasel-gl/draw.ts → @orochi235/weasel → src/index.ts → pathLayer.ts → @orochi235/weasel-gl` hits an unresolved bare specifier. The vitest config already had this alias; the dev vite config didn't. Fixed by mirroring the alias from `vitest.config.ts` into `packages/weasel-gl/dev/vite.config.ts`. Filed as new convention §14.
- **Implementer mis-reported the playwright baseline as broken.** They claimed "baseline-broken on this branch — confirmed by reproducing failures on commit 8573815" — but 8573815 is many commits before step 6's done, and I had verified 8/8 specs passing at the step-6 tip (1126765) immediately before dispatching them. Bisect showed the regression started at f451ef7 (port createPathLayer) — exactly when the missing dev alias started biting. Lesson for the controller: when an implementer says "baseline-broken," verify against your own pre-dispatch checkpoint before trusting it.
- **Vitest config also gained `@orochi235/weasel-gl` alias** as a side effect of the first cross-workspace value import (`viewToMat3`). Convention §4 anticipated this for the *first* such import — this is that moment. Documented but not novel.
- **Path representation for hairlines.** Plan sketched `{ kind: 'polygon', points: [...] }` but the actual `Path` type uses the SVG-style command-stream `PolygonPath`. Implementer correctly converted to `{ kind: 'polygon', commands: Uint8Array, coords: Float32Array, fillRule }` per existing types. Plan was sketch-level; the implementer recognized and followed the real type.
- **`createDebugOverlayLayer` layer-panel width.** Plan called for `ctx.measureText`; GL emitter has no ctx, so implementer used a 6.6px-per-char estimate. Right-edge anchoring stays correct; pixel-perfect width is not load-bearing for a debug panel.
- **Implementer caught their own off-by-one in `approximateCircle`** in a follow-up commit (148e6a9). Tree-shape tests counted commands but didn't catch trailing-junk-coords — exactly the convention §8 footprint (geometry shape needs visual smoke, not just count assertions). The smoke-spec layer scene didn't include circle approximations, so the bug landed; if there had been a pen-preview path in the smoke, it would have surfaced sooner.

## Test results

- **Vitest: 1460/1460 pass** (179 test files; +33 from the agent's port = 1427 → 1460).
- **Playwright: 13/13 specs pass** (smoke + synthetic + text + paint + colors + 3 shader + 5 layers).
- **Typecheck**: clean for `packages/weasel-gl` (modulo one pre-existing unrelated baseline error in `draw.ts(138,84)` that's not from this work).
- **Browser-verified**: layers smoke at `/packages/weasel-gl/dev/layers.html` shows the grid + green cell highlight + red and blue rects.

## Lessons for step 8+ (folded into conventions)

- **§14 (new): when one workspace package imports another, *every* vite/vitest config in the project must alias both.** Adding a new cross-package import has knock-on effects on every dev page, even ones that don't seem to use the import. The dependency chain runs through any module-level barrel imports.
- **§15 (new): tree-shape tests are necessary but insufficient for geometry-emitting layers.** Counting how many `PATH_M`/`PATH_L`/`PATH_Z` commands appear is necessary; verifying the *coords* line up with the *commands* needs at least one assertion that walks the buffer. The pen-preview circle bug passed shape-counting tests; a "first 8 coords match expected positions" assertion would have caught it. Or visual smoke covering the layer.

## Open follow-ups

- **`<Canvas>` / `<SceneCanvas>` haven't been ported yet** — that's step 8. Right now `drawGL` exists but no consumer dispatches it; the GL backend works only via direct `WeaselRenderer.render(commands)` calls (as the smoke pages do).
- **Selection handles position computation duplicated** between 2D and GL paths. Step 10's swap collapses them.
- **Text layer width measurement uses an offscreen 2D canvas** — works but couples GL emission to 2D capability. A future enhancement could read MSDF metrics directly from `registerFont` data, eliminating the canvas dependency.
- **Pre-existing `draw.ts(138,84)` typecheck warning** is unrelated; should be cleaned up in step 8 or 10.
