# Findings: core.canvas.part1

## buildSceneLayer's `toPose` shim spreads the adapter, dropping every prototype method of a class-based adapter
- where: packages/core/src/canvas/buildSceneLayer.ts:226 (buildSceneLayer, `hierarchicalAdapter`)
- scenario: a bare consumer passes a `HierarchicalAdapter` implemented as a class instance (methods on the prototype) and sets `cfg.toPose`. `{ ...a, getPose }` copies only own enumerable properties, so `getLayers`, `getNode`, `getChildren`, `composePose`, `childFrame` and `pickIdOf` are gone; `buildSceneTree` throws `adapter.getLayers is not a function` on the first draw. An adapter whose `composePose` alone lives on the prototype instead silently loses pose composition, so nested nodes paint at their local poses. It should wrap the adapter (delegate each method to `a`, as `toPoseReads` does) rather than spread it. Without `toPose`, the same adapter works.
- evidence: read
- severity: medium

## Without `toPose`, a bare adapter's derived paths read dependencies at local poses, though the `toPose` path composes them
- where: packages/core/src/canvas/buildSceneLayer.ts:169 (withAdapterDerivedPaths) with packages/core/src/canvas/adapterDerivedPath.ts:37 (poseOf)
- scenario: `buildSceneLayer` gets a `HierarchicalAdapter` with `composePose` but no `getWorldPose`. `HierarchicalAdapter` doesn't declare `getWorldPose`, and `buildSceneTree` composes poses through `composePose`. A derived edge depends on a node nested in a translated group. With `cfg.toPose` unset, `adapterDerivedPathOf(adapter)` falls back to `adapter.getPose` (the local pose), so the edge is drawn to where the child would be at the root, not where the walk paints it. With `cfg.toPose` set, `toPoseReads` composes through `composeWorldPose`, and the edge meets the child. So the same scene draws two different edges depending on whether `toPose` is passed. The no-`toPose` branch should compose the same way when the adapter has `composePose`.
- evidence: read
- severity: medium

## watchThemeOf stops at a shadow root, so a canvas in shadow DOM never hears a theme change on the document
- where: packages/core/src/canvas/accentColor.ts:60 (watchThemeOf, ancestor loop)
- scenario: a canvas mounts inside a shadow root. The kit supports this: `adoptSurfaceRule` adopts its CSS "once per root". The loop walks `node.parentElement`, which is `null` at the shadow root's top-level element, so the host element and everything above it (`<html>`, where a `data-wzl-*` theme or `class` mode is usually set) are never observed. The `<head>` sheet observer also doesn't see `<style>`s inside the shadow root. Switching the page theme then leaves `useChromeColor` consumers (the entered-group frame color in `SceneCanvas`) painting the old color until something else repaints and rereads it. The walk should continue from `getRootNode().host` when it reaches a shadow root.
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

<!-- done: 3 findings, files read: 39 -->
