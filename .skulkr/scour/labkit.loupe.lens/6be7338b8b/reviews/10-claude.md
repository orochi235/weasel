## LensZoom's release microtask runs before the slider's own pointerup listeners for real input, so the commit can leave the press's undo entry
- where: packages/labkit/src/loupe/lens/LensZoom.tsx:57 (LensZoom, watchPress `end`)
- scenario: a user releases a zoom thumb drag. `end` is a window capture-phase listener, so it runs before the slider's pointerup handling. For a browser-dispatched event the microtask checkpoint runs after each listener returns, so the `queueMicrotask` body (`gesture.current += 1`, `onRelease()`) runs before the slider's listener calls `onChange`. If the committed value differs from the last `onInput` value, `write` then batches it under a new `lens-zoom:<id>:<n+1>` coalesce key, which makes a second undo entry for one press. `press.current` is already null by then, so `gesture` is bumped a second time. Focus also goes back to the lens input before the slider has finished the press. The comment ("After the slider's own listeners for this event") only holds for synthetic `dispatchEvent` in tests, where microtasks wait until the dispatch ends.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/LensZoom.tsx
- size: function
- cause: microtask checkpoint between event listeners
- confidence: likely

## A new multi-lens selection reports the first lens selected, not the lens just added or pressed
- where: packages/labkit/src/loupe/lens/useFocusReports.ts:19 (useFocusReports, `report`)
- scenario: lens A is selected and the user Shift-clicks lens B, making the selection [A, B]. The subscription sees a new selection and calls `report()`, which reports `getSelection()[0]`, that is A. The lens actions (zoom keys, readout toggles) then act on A, though B is the lens just picked. In the same way, a press on B's body while both are selected "takes the focus back" to A, even after B's own chrome toggle set focus to B.
- evidence: read
- severity: low
- size: function
- cause: focus taken from selection order, not from the press target
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

<!-- done: 2 findings, files read: 33 -->
