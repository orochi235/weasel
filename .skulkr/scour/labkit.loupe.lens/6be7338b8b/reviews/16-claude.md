## A clone source's copy is `inert`, so the `interior` probe can never land on it
- where: packages/labkit/src/loupe/lens/cloneSource.ts:122 (CloneCell constructor)
- scenario: a host mounts `LensOverlay` with `createCloneSource` as its Live source and a `renderReadouts` that finds what the lens shows through `probeUnderLens(el, 'interior', () => elementFromPoint(...))`, which is what the `interior` probe exists for ("a host's copy of a story inside it"). Lens.less stands `.lk-lens-interior *` up to `pointer-events: auto` for that probe, but the copy box is `inert`, and HTML hit testing treats an inert subtree as `pointer-events: none` whatever its CSS says. So the probe hits `.lk-lens-cell`/`.lk-lens-slot` (or falls through) and never reaches the copied story element. The readout reads the wrong element. What should happen: the probe lands on the copied element under the point.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/cloneSource.ts, packages/labkit/src/loupe/lens/Lens.less
- size: line
- cause: `inert` used for "no input", which also removes the copy from hit testing
- confidence: likely

## `stillCopy` leaves `details[name]`, so a copied open accordion closes itself
- where: packages/labkit/src/loupe/lens/cloneSource.ts:83 (stillCopy)
- scenario: a story renders an exclusive accordion, `<details name="faq" open>`. The clone keeps `name` and `open`. When `CloneCell.recopy` connects it to the same document, the details insertion steps ("ensure details exclusivity by closing the given element if needed") see the trial's open member of group "faq" and close the copy. `mirrorState` never restores `open`, and the copy isn't observed, so the lens shows the section collapsed while the story shows it expanded. This is the same group-joining problem the function already handles for named radios. What should happen: the copy drops `name` from `details`, as it does for radios.
- evidence: read
- severity: low
- size: line
- cause: grouping attribute not stripped from the copy
- confidence: likely

## LensZoom's release microtask runs before the slider's own pointerup, so a drag's commit gets its own undo key
- where: packages/labkit/src/loupe/lens/LensZoom.tsx:56 (watchPress `end`)
- scenario: `end` listens on the window in the capture phase and queues `gesture.current += 1` in a microtask, meant to run "after the slider's own listeners for this event". For a pointerup the browser dispatches, the microtask checkpoint runs after each listener returns, so the increment (and `onRelease`, which moves focus to the lens input) runs before the slider's pointerup handler. The slider's closing `onChange` then writes under `lens-zoom:<id>:<n+1>`, not the drag's key. If the released value differs from the last `onInput` value, it records a second undo entry, breaking "a whole drag folds into one undo entry". `write(…, true)` then increments again, because `press.current` is already null. What should happen: the gesture key moves on only after the slider's commit.
- evidence: read
- severity: low
- size: function
- cause: a microtask assumed to run after later listeners of the same native event
- confidence: likely

## Files read
packages/labkit/src/loupe/lens/GridCanvas.tsx
packages/labkit/src/loupe/lens/LabLoupe.tsx
packages/labkit/src/loupe/lens/Lens.less
packages/labkit/src/loupe/lens/LensActions.tsx
packages/labkit/src/loupe/lens/LensChrome.tsx
packages/labkit/src/loupe/lens/LensOverlay.tsx
packages/labkit/src/loupe/lens/LensSlot.tsx
packages/labkit/src/loupe/lens/LensZoom.tsx
packages/labkit/src/loupe/lens/ScopeOf.tsx
packages/labkit/src/loupe/lens/cloneSource.ts
packages/labkit/src/loupe/lens/compare.ts
packages/labkit/src/loupe/lens/difference.ts
packages/labkit/src/loupe/lens/intoFrames.ts
packages/labkit/src/loupe/lens/lensActionDefs.ts
packages/labkit/src/loupe/lens/lensApi.fixture.ts
packages/labkit/src/loupe/lens/lensApi.ts
packages/labkit/src/loupe/lens/lensHitBoxes.ts
packages/labkit/src/loupe/lens/lensScene.ts
packages/labkit/src/loupe/lens/lensShapes.ts
packages/labkit/src/loupe/lens/lensSource.ts
packages/labkit/src/loupe/lens/lensTypes.ts
packages/labkit/src/loupe/lens/lensZoomTrack.ts
packages/labkit/src/loupe/lens/pixelGrid.ts
packages/labkit/src/loupe/lens/probeUnderLens.ts
packages/labkit/src/loupe/lens/reticleFollower.ts
packages/labkit/src/loupe/lens/scrollByWheel.ts
packages/labkit/src/loupe/lens/useCaptureDelay.ts
packages/labkit/src/loupe/lens/useFocusReports.ts
packages/labkit/src/loupe/lens/useFrameSchedule.ts
packages/labkit/src/loupe/lens/useLabBody.ts
packages/labkit/src/loupe/lens/useLensRemeasure.ts
packages/labkit/src/loupe/lens/useLensShapes.ts
packages/labkit/src/loupe/lens/useWheelPassThrough.ts

<!-- done: 3 findings, files read: 33 -->
