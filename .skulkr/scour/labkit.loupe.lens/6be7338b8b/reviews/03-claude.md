## Live clone strips every id, so a trial styled by id selectors renders unstyled in the lens
- where: packages/labkit/src/loupe/lens/cloneSource.ts:89 (stillCopy)
- scenario: a story whose stylesheet targets ids (`#chart .bar { fill: red }`, `#panel { padding: 8px }`, `:target`) is put under a Live lens in `LabLoupe`. `stillCopy` removes `id` from the copy root and every descendant, so none of those rules match the copy: the lens shows the bars unfilled and the panel unpadded, while the trial beside it shows them styled. The Live source is documented as "a copy of the DOM under its reticle", so the lens should look like the trial.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/cloneSource.ts
- size: function
- cause: id removal also defeats CSS id matching
- confidence: likely

## The Pixel grid draws lines past the edge of the capture, over area that has no captured pixels
- where: packages/labkit/src/loupe/lens/pixelGrid.ts:128 (drawPixelGrid)
- scenario: the tint loop is bounded by `columns` and `rows`, but the line loops run from the origin to `size.width` / `size.height` whatever the capture's extent. A capture smaller than the cell, such as a reticle near the page's right or bottom edge where the capture box is clipped, or one whose `at` puts its first pixel inside the cell, gets boundary lines drawn across the empty part of the cell, so it reads as captured pixels that are not there. The lines should stop at `origin + columns*step` and `origin + rows*step`.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/pixelGrid.ts
- size: line
- cause: line loops ignore capture extent
- confidence: likely

## Difference view shows an old capture error again after Pixels becomes available
- where: packages/labkit/src/loupe/lens/LensSlot.tsx:225 (LensDifference)
- scenario: a capture rejects (for example a timeout), so `say(message)` stores it in `said`. Pixels then goes unavailable and comes back (`status` goes to a string, then back to `true`). `reason` becomes `said` again, which still holds the old error. That stale message hides the canvas until the next capture settles, at least `LENS_REST_MS` later, or for good if that capture's effect returns early. `said` should be cleared when `status` changes.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/LensSlot.tsx
- size: line
- cause: `said` not reset on status change
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
