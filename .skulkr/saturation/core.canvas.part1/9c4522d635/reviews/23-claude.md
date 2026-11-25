# Findings: core.canvas.part1

## A `cfg.objects` scene slot never applies level of detail, so painter ladders do not switch there
- where: packages/core/src/canvas/buildSceneLayer.ts:256 (buildSceneLayer, `cfg.objects` branch)
- scenario: a slot given `objects` whose nodes' painters declare a `ladder` (or nodes carry `lod`) is zoomed far out. The hierarchical branch builds `createLodWalk` and passes each node's rung to `drawOne`. The objects branch calls `drawOne(obj, at, view, pixelScaleCtx(...))` with no rung and never consults `cfg.lod` / `cfg.lodState`, so every node paints its full representation at every size. `SceneSlotConfig.lod`'s doc says ladders "switch representations by size on screen whether or not this is set". The same decision is answered two ways depending on which branch draws.
- evidence: read
- severity: low

## `defaultDrawOne` drops the label but paints in full for a rung the painter's ladder does not define
- where: packages/core/src/canvas/defaultDrawOne.ts:44 (defaultDrawOne)
- scenario: `ctx.rung` is a rung id other than `'full'`, `'box'` or `'none'` that the matched painter's `ladder` does not list (a rung named by a node's own `lod`, or by a ladder on another registry). `own` is undefined, so control falls through to `painter.paint` (the full paint), while `text` is still forced undefined because `rung !== 'full'`. The node paints full detail with its `data.label` missing. It should either paint full with the label, or treat the unknown rung as something it can't paint.
- evidence: read
- severity: low

## `commandRasterizer` derives its source rect from the diagonal, so a rotated or flipped page view rasterizes the wrong region
- where: packages/core/src/canvas/commandRasterizer.ts:49 (commandRasterizer)
- scenario: `view` (a `GlMat3`) carries a rotation or a negative axis scale, for example a y-up page. `sx = toRaster[0]` and `sy = toRaster[4]` are then not the raster's scales. They are cos·s, or negative. The `sourceRect` and `scale` handed to `session.render` are wrong: they are skewed, or have a negative width or height. Any `world`-unit paint resolved through the session's view lands in the wrong place. The matrix is accepted as a general `GlMat3` and nothing checks that it is axis-aligned with positive scale.
- evidence: read (inference about what callers pass)
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

<!-- done: 3 findings, files read: 39 -->
