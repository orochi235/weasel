## A clone source's copy is `inert`, so the `'interior'` probe can never land inside it
- where: packages/labkit/src/loupe/lens/cloneSource.ts:121 (CloneCell constructor, `this.box.inert = true`)
- scenario: a host mounts `LensOverlay` with `createCloneSource` and a `renderReadouts` that finds the element under the reticle the way forge's `topmostIn` does (`probeUnderLens(within, 'interior', () => elementsFromPoint(...))`). The HTML spec makes hit testing treat an inert subtree as `pointer-events: none`, whatever CSS says, so `Lens.less`'s `[data-probe='interior'] .lk-lens-interior *` rule can't stand the copy up. `elementsFromPoint` returns nothing inside the copy, and a Token or Contrast readout over a Live clone lens finds no element. It should find the copied element the interior shows. `rootAt` doesn't need inert for its skip either: it already skips `[data-lk-copy]` by attribute.
- evidence: read (the inert hit-testing rule is from the HTML spec, not run here)
- severity: medium
- fix: packages/labkit/src/loupe/lens/cloneSource.ts, packages/labkit/src/loupe/lens/Lens.less
- size: line
- cause: inert used to block focus also blocks hit testing
- confidence: likely

## LabLoupe offers Token and Contrast toggles that draw nothing
- where: packages/labkit/src/loupe/lens/LabLoupe.tsx:42 (LabLoupe, `<LensOverlay>` with no `renderReadouts`)
- scenario: in a plain lab, press "Token" or "Contrast" on a lens's chrome, or `t`/`c` in the Loupe keymap. `loupe.readout.token`/`contrast` are enabled, the toggle shows as pressed, and `settings.readouts` records it. But `LensInterior` renders readouts only through `renderReadouts`, which LabLoupe never passes, so nothing appears and no reason is given. The toggles should be absent or disabled, or say why, the way Grid's label switches to `GRID_NEEDS`.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/LensChrome.tsx, packages/labkit/src/loupe/lens/lensActionDefs.ts
- size: function
- cause: readout toggles offered with no renderer behind them
- confidence: likely

## Difference view shows a stale error after Pixels comes back
- where: packages/labkit/src/loupe/lens/LensSlot.tsx:214 (LensDifference, `reason = status === true ? said : ...`)
- scenario: a capture fails and sets `said` to the error. The Pixels source then goes unavailable and comes back (`status` → string → `true`). `said` is never reset, so the old error shows again over a hidden canvas. Because `captureDelay` has already started, the next capture waits `LENS_REST_MS` before it replaces the message. The message should clear once status is `true`, or the capture should run at once.
- evidence: read
- severity: low
- size: line
- cause: `said` not cleared on status change
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
