# Audit round 68 — core.domains (blind reviewer)

## `present.step` / `present.go` stay enabled when the request names no page, so their keys are swallowed instead of falling through
- where: packages/core/src/domains/presentation/presentationContribution.ts:71 (presentationAction `enabled`)
- scenario: a canvas with pages, `wrap` off, showing the last page. Pressing ArrowRight / ArrowDown / PageDown: `enabled` answers `true` because pages exist and `requestOf` gives `{ by: 1 }`, so the dispatcher hands the key to `present.step`; `run` then gets `null` from `adjacentPage` (past the end, no wrap) and moves nothing. The key never reaches the next binding on it. The same goes for ArrowLeft/Up/PageUp on the first page, and for `present.go` with a `to` id or index that names no page (`trigger('present.go', { to: 'nope' })` reports that it ran but did nothing). `enabled` and `run` decide "is there a page to go to" in two different ways: `enabled` checks that some page exists, and `run` checks that the requested page exists. The comment above it ("A canvas with no pages leaves the keys to whatever else binds them") says the keys should fall through whenever the action cannot act. Fix: `enabled` should return NotApplicable when `requestedPage(pages, pageShown(pages, viewCamera(deps.view)), request, opts.wrap)` is null.
- evidence: read (adjacentPage in core/pages/pages.ts:157 returns null past either end without wrap)
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
