# Findings: core.canvas.part1

## buildSceneLayer resolves derived paths from uncomposed poses when the adapter composes but has no `getWorldPose`
- where: packages/core/src/canvas/buildSceneLayer.ts:136 (withAdapterDerivedPaths), with packages/core/src/canvas/adapterDerivedPath.ts:37 (poseOf)
- scenario: a bare `HierarchicalAdapter` with `composePose` (children stored local to their container) and no `getWorldPose`, no `cfg.toPose`, a derived edge whose endpoints sit inside a translated group. `buildSceneTree` paints the endpoints at their composed world poses, but `adapterDerivedPathOf(adapter)` reads `adapter.getPose` (local) for each dependency, so the edge is drawn off its endpoints by the group's offset. The `cfg.toPose` branch of the same function (`toPoseReads`) does compose through `composePose`/`childFrame`, so the one question "where is a dependency drawn" is answered two ways depending on whether `toPose` was given. `HierarchicalAdapter` does not even declare `getWorldPose`, so the composing case is the documented contract.
- evidence: read (traced both branches; not run)
- severity: medium

## The `cfg.toPose` shim spreads the adapter, dropping prototype methods
- where: packages/core/src/canvas/buildSceneLayer.ts:212 (buildSceneLayer, `hierarchicalAdapter = { ...a, getPose }`)
- scenario: a consumer passes a class-instance adapter (methods on the prototype) plus `toPose`. `{ ...a }` copies only own enumerable properties, so `getLayers`, `getChildren`, `getNode`, `composePose`, `childFrame`, `pickIdOf` are gone; `buildSceneTree` throws on `adapter.getLayers()` (or silently stops composing/ picking ids if only optional methods were on the prototype), and getters are frozen at spread time. Without `toPose` the same adapter works. A wrapper that delegates (`Object.create(a)` or explicit forwarding, as `toPoseReads` does) keeps it. No class adapter exists in the tree today; the interface is public.
- evidence: read (inference from spread semantics)
- severity: low

## watchThemeOf stops at a shadow root, so a theme change above a shadow-hosted canvas is not heard
- where: packages/core/src/canvas/accentColor.ts:62 (watchThemeOf ancestor loop), :67 (sheets observer on `document.head` only)
- scenario: a canvas mounted inside a shadow root (which `adoptSurfaceRule`'s per-root styling supports) under a page that toggles `class="dark"` on `<html>` or a `data-wzl-theme` on the shadow host's ancestors. The loop walks `parentElement`, which is `null` at the shadow root, so neither the host nor anything above it is observed; custom properties do inherit through the host, so `chromeColorOf` would read a new color but no repaint is triggered and chrome keeps the old accent. Likewise a `<style>` added inside the shadow root is not watched. Should continue from `(node.getRootNode() as ShadowRoot).host` and observe that root's sheets.
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
