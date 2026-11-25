# Findings: core.canvas.part1

## A `<CanvasView>`'s chrome hit radii ignore the `targets.*Px` kit settings the surface's chrome uses
- where: packages/core/src/canvas/affordanceAt.ts:70 (chromeAffordances)
- scenario: An app sets the kit settings `targets.handlePx`, `targets.anchorPx` or `targets.rotationDistancePx`
  (read by `useTargetBasePx`). The surface's dispatcher builds its affordances through `useChromeAffordances`,
  which resolves `targetSizesPx(targetScale, useTargetBasePx())`. A `<CanvasView>` builds its own through
  `useViewPicking` → `buildAffordanceAt({ targetScale, ... })` with no `affordances`, so `chromeAffordances`
  falls back to `targetSizesPx(opts.targetScale)` with no base: the built-in 24/handle/anchor defaults. So inside a
  view, resize handles, anchors and the rotate band are grabbed at the default radii while they are painted (and
  grabbed on the surface) at the configured ones; e.g. with `targets.rotationDistancePx` raised to 40, the rotate
  ring in a view is hit only within 24px. The same question (what size is a chrome grab zone) is answered two ways:
  `chromeAffordances`' own defaults should take the kit-setting base, or the view should go through
  `useChromeAffordances`.
- evidence: read (affordanceAt.ts:70-75, SceneCanvas/useChromeAffordances.ts:12-16, useViewPicking.ts:43-51,
  SceneCanvas/useSceneGestureDispatcher.ts:128-140)
- severity: medium

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

<!-- done: 1 findings, files read: 39 -->
