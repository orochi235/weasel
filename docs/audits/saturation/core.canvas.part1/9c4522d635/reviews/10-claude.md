# Findings: core.canvas.part1

## adapterPickSource picks nodes on a layer the adapter reports `visible: false`, which buildSceneTree never paints
- where: packages/core/src/canvas/adapterPickSource.ts:52 (adapterPickSource → order/visit)
- scenario: a bare `SelectAdapter` whose `getLayers()` returns `{ id: 'notes', visible: false }`. buildSceneTree gives that layer no bucket, so its nodes are not painted (buildSceneTree.ts:173, 208). The adapter walk only checks `hidesSubtree(node)` and the optional `gates.layerIsPainted`, and `useSelectTool`'s `adapterPickEvery`/`adapterBetween` forward `layerIsPainted` only when the consumer supplied one. A click over an invisible node selects it, and a shift-range includes it. The module doc says the walk matches "as `buildSceneTree` paints", so the two walks give different answers about the same layer flag.
- evidence: read
- severity: medium

## defaultDrawOne drops the label for a ladder rung that has no paint of its own, while still painting the full node
- where: packages/core/src/canvas/defaultDrawOne.ts:46 (defaultDrawOne)
- scenario: a painter's `ladder` declares a rung (e.g. `'simple'`) with no `paint`. With `ctx.rung === 'simple'`, `own?.paint` is undefined, so the code falls through to `painter.paint(...)` and paints the full representation. But `text` is then forced to `undefined` because `rung !== 'full'`. The node is drawn exactly as at `'full'` but without its `data.label`. It should behave like `'full'`, label included, or skip the label only for rungs that actually substitute their own paint.
- evidence: read
- severity: low

## buildSceneLayer's flat `objects` path records the debug origin at the stored pose, not the drawn pose
- where: packages/core/src/canvas/buildSceneLayer.ts:255 (buildSceneLayer draw, objects branch)
- scenario: a slot with `objects` and a `drawnPose`, such as a quantize grid, paints each object at `at = drawnAt(obj, pose)`, but `debugSink.recordOrigin` reads `pose.x/y`. The hierarchical branch records the pose the painter received, which buildSceneTree has already passed through `drawnPose`. So with `?debug=` on, the origin markers sit off the painted node by the quantize offset on one path and on it on the other.
- evidence: read
- severity: low

## useChromeColor's `changed` watches only `<html>` for good when subscribed before the canvas element mounts
- where: packages/core/src/canvas/accentColor.ts:65 (watchThemeOf), packages/core/src/canvas/accentColor.ts:85 (useChromeColor)
- scenario: `watchThemeOf` reads `el()` once at subscribe time and observes that element's ancestor chain. If a layer subscribes through `useChromeColor(...).changed` while `ref.current` is still null, only `document.documentElement` is observed. A later theme class or `data-wzl-*` change on the canvas's wrapper, the usual place a scoped theme lands, is never heard, so the entered-group frame color stays stale until something else repaints. Nothing re-subscribes once the element appears.
- evidence: read (did not check when the layer's subscription first runs relative to mount, so this is plausible)
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

<!-- done: 4 findings, files read: 39 -->
