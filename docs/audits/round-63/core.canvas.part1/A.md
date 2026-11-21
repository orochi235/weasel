I couldn't save the findings file because permission to write `.skulkr/out/findings.md` was denied. Per the brief, the whole document is below. I read all 50 listed files, made no edits, and ran no tests: all three findings come from reading the code.

# Audit round 63 — core.canvas.part1 findings

## A dependency read through a slot lookup carries no `scene`, so a boolean group's operands are outlined by the default painters instead of the scene's own
- where: packages/core/src/canvas/derivedPath.ts:143 (class SlotDep)
- scenario: Take a scene whose composition composes frames (or a reader painting through a `toPose`). It holds a boolean-of-children group, and one child is a kind that only `nodeShapesOf(scene)` paints (a preset's `shapes`). `sceneDepLookup` uses the slot path here (`memoSlotFor(undefined, true)` gives `'kit:derivedPath:world'`), so it answers `SlotDep`s. A `SlotDep` has `node`, `pose`, `path`, `inherited` and `children`, but no `scene`. The dep-outline reader at `NodeShape.ts:168` passes `shapes: nodeShapesOf(dep.scene)` only when `dep.scene` is set, so here it falls back to `defaultNodeShapes`. That registry has no painter for the kind, so the operand has no silhouette and drops out of the boolean. `SceneDep` (core/scene/effectivePose.ts) does have `get scene()`, so the same scene paints the boolean correctly when it does not compose frames. One question gets two different answers.
- evidence: read
- severity: medium

## A trimmed stroke's pick outline is memoized without the silhouette's generation or key, so it goes stale when a varying silhouette changes
- where: packages/core/src/canvas/NodeShape.ts:258 (trimmedOutlineOf)
- scenario: `findShapeSilhouette` rebuilds the silhouette of a painter with `geometryGeneration`/`silhouetteKey` when either changes (the text painter: a font face landing, `textLayoutScale` at a new zoom). `trimmedOutlineOf`, however, memoizes in `TRIM_PICK_SLOT`, keyed only on (data, pose, `strokeTrimKey(trim)`). Example: a text node with an unfilled, trimmed stroke is hit-tested once under the fallback face (or at one zoom). The face then lands (or the view zooms). `shapeCoversPoint` gets the new `sil`, but `inkCovers` gets the old trimmed outline, so a press along the visible trimmed stroke misses, or hits where nothing is drawn. The trimmed outline should be keyed on the same generation and key as the silhouette.
- evidence: read
- severity: low

## `buildSceneLayer` derives paths from local poses when given a `toPose`, but from world poses without one
- where: packages/core/src/canvas/buildSceneLayer.ts:105 (withAdapterDerivedPaths)
- scenario: A bare `buildSceneLayer`/`buildSceneLayers` caller, with no scene-aware `derivedPathOf`, passes a composing adapter (`composePose` plus `getWorldPose`). Without `cfg.toPose`, `adapterDerivedPathOf(adapter)` reads dependency poses through `getWorldPose`, i.e. world positions. With any `cfg.toPose`, even `(o) => adapter.getPose(o.id)`, the shim it builds has no `getWorldPose`. Dependencies are then read through `toPose`, which `buildSceneTree` treats as a local pose and composes itself. Example: a container at x=100 holds `a` and `b`, and an edge depends on both. With `toPose` set, the edge is drawn between their local positions, 100 units off its endpoints. The shim should compose (or pass a world-pose reader) as the no-`toPose` path does.
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
packages/core/src/canvas/layerSample.ts
packages/core/src/canvas/layerSlots.ts
packages/core/src/canvas/mountedCanvases.ts

<!-- done: 3 findings, files read: 50 -->