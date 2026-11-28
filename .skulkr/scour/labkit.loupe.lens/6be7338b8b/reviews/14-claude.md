## The interior probe in a default Split lens hits the seam element, not what the lens shows
- where: packages/labkit/src/loupe/lens/Lens.less:58 (`[data-probe='interior'] .lk-lens-interior *`), packages/labkit/src/loupe/lens/LensSlot.tsx:250 (seam div)
- scenario: a lens compares in Split with the seam at its default 0.5. A host readout (forge's `topmostIn`, under `probeUnderLens(..., 'interior')`) hit-tests the lens's aim, which is the interior's center. The probe rule sets `pointer-events: auto` on every descendant of the interior, `.lk-lens-seam` included. That element is 2px wide at `left: seamX - 1px`, with `seamX = round(width * 0.5)`, and it comes after the sides in DOM order. So it is topmost at the center, and the readout reports the seam's accent-colored div instead of the compared story. The same rule also stands up `.lk-lens-grid`, `.lk-lens-reason` and `.lk-lens-readouts`, which are the lens's own chrome too (the comment at Lens.less:63 excludes only the zoom). The compared-side `clip-path: none` rule at :105 was written for this same probe, but it does not get past the seam drawn on top.
- evidence: read
- severity: medium
- fix: packages/labkit/src/loupe/lens/Lens.less
- size: line
- cause: interior probe stands up lens chrome, not only source content
- confidence: likely

## A lens's first attach and first capture use reticle (0, 0), and the real capture then waits out LENS_REST_MS
- where: packages/labkit/src/loupe/lens/LensOverlay.tsx:178 (reticleClient), :318
- scenario: `layer` is state set by the portal div's own ref. So on the first render of the portal, `layer` is null and `reticleClient` returns `{x: 0, y: 0}` for every lens. `LensCell` attaches the source with that reticle: `CloneCell.place` runs a hit test at the page's corner and copies whatever root is there, or none. `GridCanvas`/`LensDifference` fire their first capture, with `useCaptureDelay` answering 0, at the wrong point. The re-render after `setLayer` carries the real reticle. Their effects then rerun, but `useCaptureDelay` now answers 250 ms, so the first correct capture waits LENS_REST_MS, against the contract that "its first capture is taken at once". The clone source also clones and observes a wrong root once.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/LensOverlay.tsx
- size: line
- cause: reticle computed before the layer ref has landed
- confidence: likely

## A fresh copy mirrors scroll offsets before its box is sized, so a percentage-sized scroller clamps and stays wrong
- where: packages/labkit/src/loupe/lens/cloneSource.ts:205 (CloneCell.recopy)
- scenario: `recopy` connects the copy and calls `mirrorState` (which sets `scrollTop`/`scrollLeft`) before `position()` sets `--lk-copy-w/h`. On the first copy the box has no size yet: `width: var(--lk-copy-w)` is unset, so it is shrink-to-fit. On a root change it still has the previous root's size. A scroller inside the trial sized by percentage (`height: 100%`) then has a different scroll range when the offset is written, and the browser clamps it. `drifted` is cleared at the same time, so nothing writes the offset again until the trial itself scrolls. The copy then shows the wrong scroll position.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/cloneSource.ts
- size: line
- cause: mirror before position
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
