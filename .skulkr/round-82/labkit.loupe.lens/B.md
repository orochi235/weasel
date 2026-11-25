## A Split lens with two DPRs compares the base at the first DPR against the comparison at the second, and never shows either side at the other DPR
- where: packages/labkit/src/loupe/lens/LensSlot.tsx:247 (LensSlot), with lensSource.ts:150 (requestsOf)
- scenario: a Pixels lens with `dprs` [1, 2] (the `r` key's third step), a comparison, view Split, seam at 0.5. `requestsOf` gives two cells side by side, each half the interior wide; each side (`.lk-lens-side`) holds both cells and is clipped to its half of the seam. The base side's visible half is its 1× cell and the compared side's visible half is its 2× cell, so the lens shows the story at 1× beside the comparison at 2×: a difference in DPR reads as a difference from the comparison, and base@2× and compared@1× are rendered but always clipped away. Moving the seam only trades which DPR each side shows. Split should either compare like with like in each DPR cell (seam per cell) or show one DPR.
- evidence: read
- severity: medium

## Wheel pass-through never scrolls an RTL horizontal scroller left, and claims to have scrolled it right at its end
- where: packages/labkit/src/loupe/lens/scrollByWheel.ts:31 (canMove), called at :54
- scenario: a story with a `direction: rtl` horizontal scroller under a lens. In RTL, `scrollLeft` runs from `-(scrollWidth - clientWidth)` to 0. For a wheel left (dx < 0) `at > 0.5` is never true, so the scroller is skipped and the wheel chains to an ancestor (or nothing). For a wheel right (dx > 0) at the right end (`scrollLeft` 0), `0 < room - 0.5` is true, so `scrollBy` moves nothing yet `scrollByWheel` returns true, stops the chain, and `useWheelPassThrough` calls `preventDefault`, so the ancestor that should take the scroll never does. Should test against the signed range (e.g. compare `Math.abs(scrollLeft)` with direction flipped for RTL).
- evidence: read (scrollLeft sign in RTL is the CSSOM's; the code has no direction check)
- severity: low

## The Pixel grid assumes a capture's bitmap is `box × dpr` pixels, where Difference resizes it to that
- where: packages/labkit/src/loupe/lens/GridCanvas.tsx:23 (maskOf) and :95 (drawPixelGrid call); compare difference.ts:62 (pixelsOf)
- scenario: `pixelsOf` reads a capture at `box * dpr`, enlarging nearest-neighbor "when it was taken at fewer" pixels, so a source may hand back a bitmap smaller than `box * dpr`. GridCanvas reads the bitmap at its own size and draws with a step of `factor / dpr` and `columns = bitmap.width`: for such a capture the soft-edge tint lands on the wrong cells (row j of the mask drawn at row j of a finer grid), drifting further from the origin. The same question — how many pixels a capture has per host px — is answered two ways; the grid should read the bitmap at `box * dpr` as Difference does.
- evidence: read
- severity: low

## A click on a split seam without dragging moves the seam to the press point and records an undo entry
- where: packages/labkit/src/loupe/lens/compare.ts:170 (seamAction onEnd)
- scenario: press on a seam (anywhere in its ±`SEAM_GRAB` px strip) and release without moving. No `onMove` ran, so `preview.get` is undefined and `onEnd` falls back to `at(end.world.x)`: the seam jumps up to 4 px to wherever the press landed, and `setLensOps` writes a setData op, an undo entry for a click. A release with no preview should commit nothing.
- evidence: read
- severity: low

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

<!-- done: 4 findings, files read: 33 -->
