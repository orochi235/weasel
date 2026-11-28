# Findings: labkit.loupe.lens

## A clone copy mirrors scroll offsets before it is sized, so a scrolled root shows unscrolled in the lens
- where: packages/labkit/src/loupe/lens/cloneSource.ts:196 (CloneCell.recopy)
- scenario: a lens is added (or its reticle moves onto a new root) over a trial whose root element is itself scrolled, e.g. `.lk-trial__body` scrolled 300px. `recopy` connects the clone and calls `mirrorState` before `position()`. On the first copy the box has no `--lk-copy-w`/`--lk-copy-h` yet, so `width: var(...)` is invalid and the absolutely positioned box is shrink-to-fit with auto height; the root's copy (`> * { height: 100% }`) has no overflow, and `target.scrollTop = 300` clamps to 0. On a later recopy for a different root, the box still carries the previous root's size, so the clamp is against the wrong height. `drifted` is cleared, so nothing mirrors again until the trial next fires `scroll`/`input`/`change`. A static scrolled trial shows its top in the lens indefinitely. It should show the scrolled offset.
- evidence: read
- severity: medium
- size: line
- cause: mirrorState runs before position sizes the box
- confidence: likely

## A clone copy is `inert`, which takes it out of hit testing, so the `interior` probe can never land on it
- where: packages/labkit/src/loupe/lens/cloneSource.ts:125 (CloneCell constructor)
- scenario: a host pairs the exported `createCloneSource` with `<LensOverlay renderReadouts>` and probes what a lens shows the way forge's `topmostIn` does: `probeUnderLens(interior, 'interior', () => elementsFromPoint(...))`. Lens.less stands `.lk-lens-interior *` up with `pointer-events: auto` for that probe. But the HTML spec makes an inert node hit-test as if it had `pointer-events: none`, whatever its CSS says, so the probe skips the copy and returns the interior or slot instead. A Token or Contrast readout then reads the lens's own background, not the copied story's. `LensReadoutProps.interior` documents the interior as holding "a host's copy of a story" for exactly this use. `data-lk-copy` already keeps other lenses' hit tests off the copy, so `inert` is not needed for that.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/cloneSource.ts, packages/labkit/src/loupe/lens/Lens.less
- size: line
- cause: inert overrides the probe's pointer-events
- confidence: likely

## LabLoupe offers Token and Contrast readouts that draw nothing
- where: packages/labkit/src/loupe/lens/LabLoupe.tsx:41 (LabLoupe)
- scenario: in a plain lab, press the chrome's "Token" or "Contrast" toggle, or Alt+L then `t`/`c`. The action writes the readout to the lens's settings and the toggle shows pressed. But `LabLoupe` passes no `renderReadouts` to `<LensOverlay>`, so nothing is drawn. "Grid" also only labels itself `GRID_NEEDS`, because LabLoupe has no Pixels source. The lens offers controls that silently do nothing. It should either hide or disable those readouts when no host renders them, or draw them itself.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/LensChrome.tsx, packages/labkit/src/loupe/lens/lensActionDefs.ts
- size: function
- cause: readout toggles not gated on a renderer
- confidence: sure

## The pixel grid's lines run past the capture's extent
- where: packages/labkit/src/loupe/lens/pixelGrid.ts:131 (drawPixelGrid)
- scenario: a Pixels capture covers less than the cell, or starts inside it (`origin.x > 0`), for example a capture clipped at the page edge. The tint loop is bounded by `columns` and `rows`, but the line loops run from the first boundary at or after 0 through `size.width`/`size.height` regardless. Grid lines are drawn over area that has no captured pixels, at boundaries of pixels that do not exist. Lines should stop at `origin + columns*step` and `origin + rows*step`.
- evidence: read
- severity: low
- size: function
- cause: line loops ignore columns/rows
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

<!-- done: 4 findings, files read: 33 -->
