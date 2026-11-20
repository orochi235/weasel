The first write to `.skulk/out/findings.md` went through, but later writes were refused. That file holds only the first finding; the full document is below.

# Findings: core.canvas.part1

## A tile of a canvas that first painted whole with WebGPU builds a WebGPU renderer, erasing its co-tenants
- where: packages/core/src/canvas/canvasBackend.ts:76 (chooseBackend), packages/core/src/canvas/canvasRenderer.ts:226 (createRenderer)
- scenario: a canvas's first renderer is built whole with `backend: 'webgpu'` or `'auto'`, so `CHOSEN` records webgpu. Later the canvas is bound with `tile`: a lease switching to tiled, or a second tenant. `want = chosen ?? (shared ? 'webgl2' : asked)` picks the remembered `webgpu` over `shared`, and `createWebGPU` ignores `shared`. A WebGPU renderer then presents its whole buffer over the shared one, which the `CanvasBackend` doc says a tile never does. It should refuse, since the canvas can no longer open WebGL 2, rather than build a renderer that erases its co-tenants.
- evidence: read
- severity: low

## watchThemeOf only hears attribute changes, so a token override made in a stylesheet or inline style never repaints chrome drawn in that color
- where: packages/core/src/canvas/accentColor.ts:25 (watchThemeOf), :18 (THEME_ATTRIBUTE)
- scenario: forge's token overrides (`createOverrides` in `packages/forge/src/frame/cssVars.ts`) set `--wzl-accent` or the entered-group frame token by rewriting a `<style data-fg-overrides>` in `<head>`. A consumer can do the same with `style={{ '--wzl-accent': … }}` on a wrapper. Neither changes a `data-wzl-*` or `class` attribute on the canvas's ancestors: the observer never fires for the stylesheet, and the filter drops the `style` change. So `useChromeColor(...).changed` stays silent, and the entered-group frame layer subscribes to it as its repaint trigger (`domains/selection/enteredGroupFrame.ts:44`). The frame keeps the old color until something unrelated repaints. The filter should let `style` through and something should hear head stylesheet changes, or the doc should say what is heard.
- evidence: read
- severity: low

## `<SceneViewCanvas>` has no `redrawOn`, so an `alphaFor` that reads outside state goes stale
- where: packages/core/src/canvas/SceneViewCanvas.tsx:46 (alphaFor prop), :164 (useCanvasSurface call)
- scenario: the prop doc tells callers to pass the same `alphaFor` the main canvas uses, to keep a scoping dim in step. On `<Canvas>`/`<SceneCanvas>`, that function's outside state is declared through `redrawOn` ("typically what an `alphaFor` consults", canvasProps.ts:89). `PageSceneView` subscribes only to the scene version, overrides, scroll and the animator, and takes no `redrawOn`. With a stable `alphaFor` that reads a store, the main canvas re-dims when the store changes, while the scene view keeps the old alphas until the scene or a prop changes. `useCanvasSurface` already takes `redrawOn` (DrawCanvas passes it); this path drops it.
- evidence: read
- severity: low

## Files read
packages/core/src/canvas/Canvas.tsx
packages/core/src/canvas/CanvasView.tsx
packages/core/src/canvas/CursorCoordsHud.tsx
packages/core/src/canvas/DrawCanvas.tsx
packages/core/src/canvas/GestureReason.module.css
packages/core/src/canvas/GestureReason.tsx
packages/core/src/canvas/ModalityHud.tsx
packages/core/src/canvas/NodeShape.ts
packages/core/src/canvas/PickHud.tsx
packages/core/src/canvas/SceneCanvas.tsx
packages/core/src/canvas/SceneViewCanvas.tsx
packages/core/src/canvas/SurfaceCanvas.tsx
packages/core/src/canvas/ViewMarker.tsx
packages/core/src/canvas/accentColor.ts
packages/core/src/canvas/adapterDerivedPath.ts
packages/core/src/canvas/adapterPickSource.ts
packages/core/src/canvas/affordanceAt.ts
packages/core/src/canvas/ambientContributions.tsx
packages/core/src/canvas/bestHitPicker.ts
packages/core/src/canvas/buildSceneLayer.ts
packages/core/src/canvas/buildSceneTree.ts
packages/core/src/canvas/canvasBackend.ts
packages/core/src/canvas/canvasBackendContext.ts
packages/core/src/canvas/canvasExtension.ts
packages/core/src/canvas/canvasProps.ts
packages/core/src/canvas/canvasRenderer.ts
packages/core/src/canvas/canvasViewProps.ts
packages/core/src/canvas/centersBetween.ts
packages/core/src/canvas/commandRasterizer.ts
packages/core/src/canvas/contentBounds.ts
packages/core/src/canvas/contextAttributes.ts
packages/core/src/canvas/copiesAbove.ts
packages/core/src/canvas/defaultDrawOne.ts
packages/core/src/canvas/derivedPath.ts
packages/core/src/canvas/devtoolsLabel.tsx
packages/core/src/canvas/doubleClickTarget.ts
packages/core/src/canvas/drawEnvelope.ts
packages/core/src/canvas/drawnBounds.ts
packages/core/src/canvas/gestureBounds.ts
packages/core/src/canvas/hostAnchor.ts
packages/core/src/canvas/hud.module.css
packages/core/src/canvas/inheritedPaints.ts
packages/core/src/canvas/inkBoxes.ts
packages/core/src/canvas/insertPreviewExtent.ts
packages/core/src/canvas/kitRequirements.ts
packages/core/src/canvas/layerHover.ts
packages/core/src/canvas/layerOrder.ts

<!-- done: 3 findings, files read: 47 -->