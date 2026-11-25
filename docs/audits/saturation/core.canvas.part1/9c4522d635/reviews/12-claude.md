# Findings: core.canvas.part1

## The scene slot's `toPose` shim spreads the adapter, losing prototype methods and freezing getters
- where: packages/core/src/canvas/buildSceneLayer.ts:212 (buildSceneLayer, `hierarchicalAdapter`)
- scenario: a `SceneSlotConfig` with `toPose`, over an adapter that is a class instance (methods on the prototype) or exposes a getter. `{ ...a, getPose }` copies only own enumerable properties, so `getLayers`/`getNode`/`getChildren`/`composePose`/`childFrame`/`pickIdOf` are gone. `buildSceneTree` then throws on `adapter.getLayers()`, or quietly drops composition and pick ids for the optional ones. A getter is read once at spread time. The same file's `toPoseReads` (line 152) wraps the adapter method by method and survives this, so the two `toPose` paths answer differently. It should build the shim like `toPoseReads`, or delegate through a prototype (`Object.create(a)`).
- evidence: read
- severity: medium

## The bare-adapter pick source picks ids the paint skips because `getNode` has no node for them
- where: packages/core/src/canvas/adapterPickSource.ts:43 (nodeOf / order)
- scenario: `getChildren` lists an id whose `getNode` answers `undefined`, for example a child removed while a parent's list is stale. `buildSceneTree.visit` returns for `!node`, so nothing is painted. `nodeOf` spreads `undefined` into `{ id, pose: worldPose(id) }`, `hidesSubtree` is false, and the walk pushes it as a candidate and descends into it. The result is an invisible, pickable target, or a throw from `getWorldPose` on an unknown id. It should skip a missing node as the paint walk does.
- evidence: read
- severity: low

## The objects path records a node's debug origin at its stored pose, not where it is drawn
- where: packages/core/src/canvas/buildSceneLayer.ts:252 (buildSceneLayer, `cfg.objects` branch)
- scenario: a slot with `objects` and a `drawnPose` (a quantize rule). The node is painted at `at = drawnAt(obj, pose)`, but `recordOrigin` uses `pose.x/y`. On the hierarchical path, `filteredDrawOne` receives the drawn pose from `buildSceneTree` and records that. The debug overlay's origin marker therefore sits off the painted node by the quantization step on one path and not the other.
- evidence: read
- severity: low

## A container's clip is built from its undrawn world pose while its paint uses `drawnPose`
- where: packages/core/src/canvas/buildSceneTree.ts:253 (visit, `ownClipOf(..., pose, ...)`)
- scenario: a scene with an output-grid `drawnPose` and a clipping container at a fractional position. The container's own paint (its frame or fill) is drawn at `drawn`, but the clip it imposes on its children is computed at the raw `pose`. Children are cut along an edge up to one grid step away from the container's painted edge, so a sliver of child shows past the frame or is cut short inside it.
- evidence: read
- severity: low

## Any non-`full` rung drops the label overlay, even when the full painter paints the node
- where: packages/core/src/canvas/defaultDrawOne.ts:48 (defaultDrawOne, `text = … rung !== 'full' ? undefined …`)
- scenario: the LOD walk hands a rung id whose ladder entry has no `paint` (or one the painter does not list). `own?.paint` is undefined, so control falls through to `painter.paint`, which is the full representation. The label condition still tests only `rung !== 'full'`, so the `data.label` overlay vanishes from a node drawn exactly as at full detail.
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

<!-- done: 5 findings, files read: 39 -->
