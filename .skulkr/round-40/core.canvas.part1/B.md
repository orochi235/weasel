# Audit round 40 — core.canvas.part1

## `<Canvas>` keeps the old `<canvas>` in the mounted-canvas registry when its element is replaced
- where: packages/core/src/canvas/Canvas.tsx:92 (CanvasInner, the `registerMountedCanvas` layout effect)
- scenario: a `<SceneCanvas>` whose `worker` prop goes from unset to set, or back (a demo toggling worker painting), turns `CanvasSurface` from a bare `<SurfaceCanvas>` into `<WorkerCanvasStack top={<SurfaceCanvas>}>`. The two trees differ, so React unmounts the `<canvas>` and mounts a new one, and `setOwnCanvas` points `canvasRef` at it. The effect's deps (`canvasRef`, `detached`, `inputElement`, `getView`) are all unchanged, so it never re-runs. `mountedCanvasRegistry` keeps the removed element, and the live canvas is never registered. `findMountedCanvas(root, hint)` then returns null for the canvas on screen, so DOM chrome that finds the camera beneath it (a text-edit container) loses it. `useSurfaceInput` in the same component re-attaches on every commit when the element changes; this effect should handle the swap the same way.
- evidence: read (Canvas.tsx:92-96, 177-185; useCanvasElements.ts setOwnCanvas; renderWorker/useWorkerStack.ts `present = surface !== undefined`; useSurfaceInput.ts:36-41 for the other half of the decision)
- severity: low

## `<SceneCanvas>`'s scene-slot cull still boxes a path node by its stored pose, not by the override path it is drawn from
- where: packages/core/src/canvas/buildSceneLayer.ts:139-142 (buildSceneLayer `culledIn` → `paintMissesView`), fed by packages/core/src/canvas/SceneCanvas/sceneSlotWiring.ts:52-53
- scenario: `<SceneCanvas layers={{ scene: { drawOne: defaultDrawOne, cull: true } }}>` (so `paintBounds` is `defaultPaintBounds`). An anchor edit or a rig publishes a pose override whose `path` reaches past the node's pose box, and that box is off screen while part of the path is on it. `withDerivedPaths` paints the node from the override path (`showsComputedPath` is true). But the slot's `paintBounds` is wrapped only in `withShownNode`/`withSceneShapes`/`withInheritedPaintBounds`, never in `withOverridePathBounds` (derivedPath.ts:242). `paintMissesView` therefore measures the stored pose box, culls the node, and the visible part of the path disappears. Commit 0bb71da607 fixed exactly this for `<SceneViewCanvas>` (sceneViewRender.ts:182 adds `withOverridePathBounds`), but not for the main canvas, so the two renders cull the same node differently.
- evidence: read (buildSceneLayer.ts culledIn; sceneSlotWiring.ts:52-53; sceneViewRender.ts:182; `git show 0bb71da607`)
- severity: medium

## `insertPreviewExtent` throws on an `insertPreview` overlay whose `extras` is not an object
- where: packages/core/src/canvas/insertPreviewExtent.ts:93-129 (extentOf, the `line` / `polygon` / `star` / `pencil` cases)
- scenario: the routing overlay types `extras` as `unknown` (routing/src/interactions/actions/overlay.ts:95), and `InsertPreviewLike.extras` is `unknown` too. A consumer action that publishes `{ kind: 'insertPreview', shape: 'line', bounds, extras: undefined }` (or `null`) reaches `resolveOverlays` → `insertPreviewExtent`, and also `dispatcherGestureBounds`. `extentOf` casts `ov.extras` and reads `e.a` / `e.center` / `e.samples` off it, which throws a TypeError inside the paint and the gesture-bounds read. The code's own fallbacks (`e.a ?? bounds corner`, `e.samples ?? []`) show a missing field is meant to fall back to the drag rect. A missing `extras` should do the same (`(ov.extras ?? {})`), not crash. The kit's own insert action always passes an object, so only a custom action hits this.
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
