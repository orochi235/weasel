# labkit.loupe.lens: blind review findings

## Difference view shows a stale failure message (or a blank canvas) after Pixels recovers
- where: packages/labkit/src/loupe/lens/LensSlot.tsx:207 (LensDifference)
- scenario: a capture fails or answers `{ reason }`, so `say("…")` stores it. Then the Pixels source's status drops to a string, so `reason` becomes `unavailableText(...)` and the effect at line 209 clears the canvas. When the status comes back to `true`, `reason` falls back to the old `said`, and the stale failure text shows until the new capture lands. That capture waits `LENS_REST_MS`, because `captureDelay()` is past its first run, plus the capture time. If `said` was null instead, the cleared, empty canvas shows with no message over that span. Both cases need `said` reset when the status leaves `true`, or when a new capture starts.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/LensSlot.tsx
- size: line
- cause: `said` not reset on status change
- confidence: likely

## paintDifference bails without drawing, yet the lens clears its message, so the previous diff shows as current
- where: packages/labkit/src/loupe/lens/difference.ts:85 (paintDifference)
- scenario: when `readBitmap` returns null for either capture (no 2d context), `paintDifference` returns 0 without touching `canvas`. LensDifference then calls `say(null)` (LensSlot.tsx:176), which un-hides the canvas, and the last diff drawn, for a different reticle, factor or comparison, is shown as this one. The early return should clear the canvas, or LensDifference should report that nothing was drawn.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/difference.ts, packages/labkit/src/loupe/lens/LensSlot.tsx
- size: line
- cause: failed draw path leaves the old image and reports success
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
