# Findings: labkit.annotations (round 67)

## An SVG base without a `viewBox` is cropped, not scaled, in an export
- where: packages/labkit/src/annotations/capture.ts:31 (nestBaseSvg)
- scenario: a target's `base()` returns `<svg width="800" height="600">…</svg>` (no `viewBox`) for a content box of 400×300. `nestBaseSvg` overwrites `width`/`height` with 400/300 and adds no `viewBox`, so the nested `<svg>` draws its 800×600 user space at 1:1 into a 400×300 viewport: only the top-left quarter of the base shows under the marks. It should synthesize `viewBox="0 0 <old width> <old height>"` from the original width/height before replacing them, so the base scales into the content box as the comment ("re-frame … onto the content box") promises.
- evidence: read
- severity: medium

## `add` on a target with no known content box leaves an empty scene behind
- where: packages/labkit/src/annotations/markWrites.ts:49 (add)
- scenario: `add({ target: 'nope', … })` for an undeclared target (or one not yet sized). `o.openScene(init.target)` runs before the argument `fracToWorld(frac, contentOf(init.target))` is evaluated, so a scene is created and tracked, then `contentOf` throws. The empty scene stays in `scenes`: `toJSON()` writes `scenes.nope`, `liveTargets()` lists it, and a reload materializes it again. The content check should run before the scene is opened.
- evidence: read
- severity: low

## `setMeta` writes a legacy mark back unsettled, unlike `update`
- where: packages/labkit/src/annotations/markWrites.ts:87 (setMeta)
- scenario: a mark loaded from a pre-`shape` save while its target was 0×0 still carries `points` in content-box units. `update` writes it back through `settledMarkData` ("A legacy mark is written back settled"), but `setMeta` spreads `found.node.data` as is, so after `setMeta` the node keeps its legacy `points` and the two writes answer "is this mark settled on write" differently. `setMeta` should go through the same settling (or through `update`).
- evidence: read
- severity: low

## `useAnnotations` misses a mark change made between a consumer's render and its subscription
- where: packages/labkit/src/annotations/AnnotationsContext.ts:12 (useMarkVersion)
- scenario: the snapshot `useSyncExternalStore` reads is a per-component counter that only the subscribed listener bumps, not a value the store itself holds. React subscribes in a passive effect and then re-checks the snapshot to catch changes made since render, but a change made in that window never bumped the counter, so the check sees no change. Example: `AnnotationOptions.stories.tsx`'s `Start` adds two marks in its `useEffect`; a `<MarkList>` that rendered "No marks yet" in the same commit and subscribes after `Start`'s effect runs keeps showing "No marks yet" until some later mark change. The snapshot should come from the store (a version it counts on every emit, as `createLabMarkStores` does with `stores.getVersion`).
- evidence: read
- severity: medium

## A stale text mark is drawn exactly like a fresh one
- where: packages/labkit/src/annotations/paint.ts:129 (markCommands, `text` case)
- scenario: a titled text mark whose `positionDependsOn` value changed resolves `style.stale = true`, but the titled-text branch emits only a `textCommand` with a fill and never reads `style.stale`; every other kind gets `STALE_DASH`. On the pane and in an export the stale label is indistinguishable from a current one, although `MarkStyle.stale` says a stale mark is "drawn dashed rather than hidden" so it can be told apart.
- evidence: read
- severity: low

## Note on the tree
The brief names commit a2dfd0456e1787d352e92d6a6a6ad07fce7f5229, but this checkout's HEAD is 1eae5ad17c4a29325f133d1fdcce46eab891be05, `git diff` reports that sha as a bad object, and the working tree has uncommitted changes. Findings are against the files as they sit on disk here, so line numbers may not match the frozen commit.

## Files read
packages/labkit/src/annotations/AnnotationOptions.less
packages/labkit/src/annotations/AnnotationOptions.stories.tsx
packages/labkit/src/annotations/AnnotationOptions.tsx
packages/labkit/src/annotations/AnnotationOverlay.tsx
packages/labkit/src/annotations/AnnotationTargets.tsx
packages/labkit/src/annotations/Annotations.less
packages/labkit/src/annotations/AnnotationsContext.ts
packages/labkit/src/annotations/ExportMenu.tsx
packages/labkit/src/annotations/MarkList.tsx
packages/labkit/src/annotations/calibration/Calibration.less
packages/labkit/src/annotations/calibration/Calibration.stories.tsx
packages/labkit/src/annotations/calibration/CalibrationPicture.tsx
packages/labkit/src/annotations/calibration/CalibrationResults.tsx
packages/labkit/src/annotations/calibration/calibrationInstrument.tsx
packages/labkit/src/annotations/calibration/condition.ts
packages/labkit/src/annotations/calibration/exercises.ts
packages/labkit/src/annotations/calibration/score.ts
packages/labkit/src/annotations/calibration/trialPictures.ts
packages/labkit/src/annotations/capture.ts
packages/labkit/src/annotations/drawOne.ts
packages/labkit/src/annotations/frac.ts
packages/labkit/src/annotations/history.ts
packages/labkit/src/annotations/index.ts
packages/labkit/src/annotations/labMarkStores.ts
packages/labkit/src/annotations/labMarks.ts
packages/labkit/src/annotations/markData.ts
packages/labkit/src/annotations/markGesture.ts
packages/labkit/src/annotations/markId.ts
packages/labkit/src/annotations/markReads.ts
packages/labkit/src/annotations/markScenes.ts
packages/labkit/src/annotations/markShape.ts
packages/labkit/src/annotations/markTools.ts
packages/labkit/src/annotations/markWrites.ts
packages/labkit/src/annotations/options.ts
packages/labkit/src/annotations/overlayCanvas.ts
packages/labkit/src/annotations/overlayPlacement.ts
packages/labkit/src/annotations/overlayTile.ts
packages/labkit/src/annotations/paint.ts
packages/labkit/src/annotations/preload.ts
packages/labkit/src/annotations/query.ts
packages/labkit/src/annotations/saveCapture.ts
packages/labkit/src/annotations/selectionStyle.ts
packages/labkit/src/annotations/staleness.ts
packages/labkit/src/annotations/store.ts
packages/labkit/src/annotations/svgNodes.ts
packages/labkit/src/annotations/toolMap.ts
packages/labkit/src/annotations/types.ts
packages/labkit/src/annotations/useLabToolOptions.ts
packages/labkit/src/annotations/view.ts
packages/labkit/src/annotations/wheelScroll.ts

<!-- done: 5 findings, files read: 50 -->

