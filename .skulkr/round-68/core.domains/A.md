# Audit round 68 — core.domains

## Entered-group frame rect gets a negative width/height on a flipped view axis
- where: packages/core/src/domains/selection/enteredGroupFrame.ts:50-61 (createEnteredGroupFrameLayer draw)
- scenario: a view with `scale.y < 0` (a y-up canvas) or `scale.x < 0`. The frame is built as `{ x, y }` from `viewWorldToScreen(view, b)` (the world top-left corner) with `width: b.width * view.scale.x`, `height: b.height * view.scale.y`, so the rect path carries a negative height anchored at the wrong corner. `@weasel-js/geom` already answers this question with `viewRectToScreen`, which is documented as giving a positive width/height with `x`/`y` at the on-screen top-left on a flipped axis; this layer answers it a second way. Any consumer of the rect path that assumes non-negative extents (bounds, culling, dash phase, GL tessellation) mis-draws or culls the frame. Should use `viewRectToScreen(view, b)`.
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

<!-- done: 1 findings, files read: 34 -->
