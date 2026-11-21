# Audit round 65 — core.domains — findings

## The entered-group frame projects through the pan/zoom form, so far from the origin it drifts off the group the canvas draws
- where: packages/core/src/domains/selection/enteredGroupFrame.ts:52-61 (createEnteredGroupFrameLayer draw)
- scenario: a group entered at world x ≈ 1e12 under zoom ≈ 1e3 (or any |world·zoom| near 1e15). The frame's corner is `worldToScreen(b.x, b.y, viewToTransform(view))` = `panX + x·zoom` with `panX = −view.x·zoom`, and the boolean operands' outlines go through the affine `[zoom, 0, 0, zoom, panX, panY]` — both add two values near world·zoom and cancel, losing whole pixels. The canvas paints the group itself through `(world − view)·scale`, which is exact to the on-screen difference, so the dashed frame and operand outlines sit a pixel or more off the group they mark. Should project with geom's `viewWorldToScreen` (subtract first), as 86b43d16fd and fb4710c20d did for `sceneNodeClientRect` and `useNodeOverlayFrame`.
- evidence: read
- severity: low

## The workspace tint's page cut-out projects through the pan/zoom form, so far from the origin the strips miss the page edge
- where: packages/core/src/domains/modes/modeLayers.ts:69-71 (createWorkspaceTintLayer draw)
- scenario: a document whose page sits at world x ≈ 1e12 viewed at zoom ≈ 1e3. The page's screen rect is `worldToScreen(page.x, …, viewToTransform(view))` = `−view.x·zoom + page.x·zoom`, two values near 1e15 cancelling, so the strips' inner edges land a pixel or more off the page the canvas draws through `(world − view)·scale`: a tinted sliver over the page's edge, or an untinted gap beside it. Should use `viewWorldToScreen`, as the precision fix in 86b43d16fd did elsewhere.
- evidence: read
- severity: low

## Files read
packages/core/src/domains/chrome-caps/conditions.ts
packages/core/src/domains/chrome-caps/defaults.ts
packages/core/src/domains/chrome-caps/index.ts
packages/core/src/domains/chrome-caps/resolve.ts
packages/core/src/domains/chrome-caps/types.ts
packages/core/src/domains/chrome-caps/useChromeCaps.ts
packages/core/src/domains/chrome-caps/useHoverTracking.ts
packages/core/src/domains/ingestion/contentHandlers.ts
packages/core/src/domains/ingestion/index.ts
packages/core/src/domains/ingestion/openFilePicker.ts
packages/core/src/domains/ingestion/placement.ts
packages/core/src/domains/ingestion/useCanvasIngestion.ts
packages/core/src/domains/longPress/longPressFeedback.ts
packages/core/src/domains/modes/modeLayers.ts
packages/core/src/domains/modes/modeTriggers.ts
packages/core/src/domains/pathEffects/effectSources.ts
packages/core/src/domains/pathEffects/hiddenSources.ts
packages/core/src/domains/pathEffects/index.ts
packages/core/src/domains/pathEffects/readSource.ts
packages/core/src/domains/pathEffects/useEffectSourcesLayer.ts
packages/core/src/domains/poseRun/index.ts
packages/core/src/domains/poseRun/usePoseRun.ts
packages/core/src/domains/presentation/index.ts
packages/core/src/domains/presentation/presentationContribution.ts
packages/core/src/domains/presentation/presentationStep.ts
packages/core/src/domains/selection/enteredGroupFrame.ts
packages/core/src/domains/selection/enteredGroupScope.ts
packages/core/src/domains/selection/enteredOperands.ts
packages/core/src/domains/viewports/aim.ts
packages/core/src/domains/viewports/index.ts
packages/core/src/domains/viewports/viewMarker.ts
packages/core/src/domains/viewports/viewMarkerDrag.ts
packages/core/src/domains/viewports/viewResolver.ts
packages/core/src/domains/viewports/viewportLayer.ts

<!-- done: 2 findings, files read: 34 -->
