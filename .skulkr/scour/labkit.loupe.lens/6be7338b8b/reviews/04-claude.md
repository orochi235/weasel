# Findings: labkit.loupe.lens

## A Live lens over open state kept outside the markup (an exclusive `<details name>`, a showing popover) shows it closed
- where: packages/labkit/src/loupe/lens/cloneSource.ts:85 (stillCopy), :62 (mirrorState)
- scenario: a trial renders `<details name="faq" open>` (an exclusive accordion). `recopy` clones it and connects the copy to the same document. The copy and the trial's element are now two open `<details>` in one name group, and the HTML insertion steps for `<details>` close the newly inserted one. The lens shows the section collapsed while the trial shows it open. `stillCopy` already strips radio `name` for the same reason (joining the trial's group), but not `details[name]`, and `mirrorState` never copies `open`. Likewise, an element opened with `showPopover()` holds its showing state outside the markup. The clone is not showing, so the UA's `[popover]:not(:popover-open) { display: none }` hides it in the lens.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/cloneSource.ts
- size: function
- cause: grouping and open state not stripped or mirrored
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

<!-- done: 1 findings, files read: 33 -->
