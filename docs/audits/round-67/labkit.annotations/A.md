## A mark change made before a reader subscribes is never shown: the version counter only moves inside the listener
- where: packages/labkit/src/annotations/AnnotationsContext.ts:12 (useMarkVersion)
- scenario: `useSyncExternalStore`'s snapshot is `version.current`, a per-component ref incremented only inside the subscribed callback. React subscribes in a passive effect and then re-reads the snapshot to catch changes made between render and subscription; here that re-read returns the same number, because nothing counted a change the listener was not yet attached for. So a `<MarkList>` / `<CalibrationResults>` / `<ExportMenu>` rendered in the same commit as an effect that writes marks (a child or earlier sibling's `useEffect` calling `add`/`setSelection`, as the AnnotationOptions story's `Start` does, or a store restored and edited before the panel's effect runs) keeps rendering the pre-change answer ("No marks yet") until some later, unrelated change fires. The snapshot should come from the store (a version the store bumps on every notify, as `LabMarkStores.version()` does), not from a counter the subscriber maintains.
- evidence: read (React `useSyncExternalStore` subscribe-then-recheck semantics; code inferred, not run)
- severity: medium

## PNG Copy calls `clipboard.write` only after the capture's awaits, so it loses user activation (always on Safari, after ~5 s on Chromium)
- where: packages/labkit/src/annotations/saveCapture.ts:32 (copyCapture), reached from packages/labkit/src/annotations/ExportMenu.tsx:68 (useCaptureRun)
- scenario: Copy runs `await marks.capture(...)` (base thunk, image load, `warmRender`, `toBlob`) and only then `navigator.clipboard.write([new ClipboardItem({'image/png': blob})])`. Safari requires `clipboard.write` to be called synchronously inside the click with a `ClipboardItem` whose value is a promise; called after awaits it rejects with NotAllowedError, so Copy always shows an error there. Chromium's transient activation expires (~5 s), so a slow 4× capture fails the same way. The SVG branch (`copyText` after `await blob.text()`) has the same shape. Should start the write in the gesture with `new ClipboardItem({'image/png': capturePromise.then(r => r.blob)})`.
- evidence: inference (browser clipboard activation rules; not run)
- severity: medium

## `add` on a target with no known content box throws but leaves a new empty scene behind, which `toJSON` then persists
- where: packages/labkit/src/annotations/markWrites.ts:49 (add)
- scenario: `o.openScene(init.target).add({ ..., pose: fracToWorld(frac, contentOf(init.target)) })` evaluates `openScene` before the argument object, so `contentOf` throws (unknown target, or one not yet sized) only after the scene was created, tracked by `MarkHistory`, subscribed, and added to `scenes`. A host calling `add` with a mistyped target id, or before layout, gets the throw and also a permanent empty scene: `toJSON().scenes` gains a key for it, `liveTargets()` lists it, and every later load re-materializes it. The content check should run before `openScene`.
- evidence: read
- severity: low

## A coalesced write that folds into an earlier scene entry does not move the cross-target undo order
- where: packages/labkit/src/annotations/history.ts:64 (MarkHistory.observe) with markWrites.ts:72 (update)
- scenario: The order is kept from `historyIndex()` growth alone. Restyle mark on target A under coalesce key `k` (A's scene gains an entry; order `[A]`), then an unkeyed change on target B (order `[A, B]`, `open` reset), then within the scene's coalesce window another write on A under `k` (e.g. the same slider or title burst from `useMarkGesture`, whose key is still `k`): A's scene folds it into its existing entry, depth is unchanged, so `observe` neither appends a step for A nor drops B's/other targets' redo. Undo now takes back B first although A's edit was the most recent thing done, and a redo held on another target survives a new edit on A.
- evidence: read (sequence reasoned through `observe`/`grouped`/`step`; not run)
- severity: low

## Wheel hand-off treats a scroller sitting at a fractional end position as still scrollable, swallowing the wheel
- where: packages/labkit/src/annotations/wheelScroll.ts:17 (scrolls)
- scenario: `at < max` compares `scrollTop`/`scrollLeft`, which can be fractional (page zoom, high DPR: e.g. 299.5), against `scrollHeight - clientHeight`, which are rounded integers (300). A scroller inside the target that is visually at its end still reports "can scroll"; `scrollUnder` adds the delta (a no-op), returns true, and `useWheelHandOff` calls `preventDefault`, so the wheel neither reaches an outer scroller nor the page. Needs a tolerance (`at < max - 1`).
- evidence: inference (browser scroll-position rounding; not run)
- severity: low

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
