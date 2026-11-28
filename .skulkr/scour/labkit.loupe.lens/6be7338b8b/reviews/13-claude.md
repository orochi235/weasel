# Findings: labkit.loupe.lens

## A fresh Live copy mirrors its scroll offsets before the copy has been sized, so a scrolled trial shows unscrolled
- where: packages/labkit/src/loupe/lens/cloneSource.ts:203 (CloneCell.recopy)
- scenario: a lens's reticle lands on a trial whose body (or a scroller inside it) is scrolled, and the cell copies it for the first time (in the constructor's `place()`) or after the reticle moves onto a different root. `recopy` connects the clone and calls `mirrorState` before `position()` sets `--lk-copy-w`/`--lk-copy-h`. On the first copy those properties are still unset, so `.lk-lens-copy` falls back to shrink-to-fit width and auto height (its `> *` child at `height: 100%` of an auto height). The copy's scrollers have little or no overflow then, so the `scrollTop`/`scrollLeft` assignments clamp to 0 or to a smaller maximum. After a root change the sizes are the previous root's, with the same result. `position()` then gives the copy its real size, but `drifted` was already cleared, so nothing mirrors again until the trial fires its own `scroll`/`input`/`change`. The lens keeps showing the wrong part of a scrolled pane. It should size the box first (call `position()` before `mirrorState`), or mirror again after positioning.
- evidence: read
- severity: medium
- fix: packages/labkit/src/loupe/lens/cloneSource.ts
- size: line
- cause: mirror before layout size is set
- confidence: likely

## Two quick toggles of the same lens setting merge into one undo entry that changes nothing
- where: packages/labkit/src/loupe/lens/lensScene.ts:248 (setLensOps)
- scenario: every `setLensOps` op carries `coalesceKey: lens:<id>:<sorted patch keys>`. The history recorder (`packages/history/src/recording.ts` `canCoalesce`) merges consecutive entries with the same keys inside its coalesce window. So pressing Alt+L then `t` twice in quick succession (token readout on, then off), or `v`/`x` back and forth, or toggling a chrome readout on and off, folds into one entry. Its net effect is no change, and the first Undo press visibly does nothing. Zoom-in pressed twice likewise becomes a single undo step. Discrete toggles should not share a coalesce key: keep the key only for continuous writes (the seam, the factor while dragging), which pass their own.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/lensScene.ts, packages/labkit/src/loupe/lens/lensActionDefs.ts
- size: function
- cause: coalesce key on discrete toggles
- confidence: likely

## A canceled quick-lens press closes the lens as though it were a tap
- where: packages/labkit/src/loupe/lens/lensActionDefs.ts:333 (quick action, onEnd)
- scenario: the quick lens is open, and F2 is pressed again and then canceled within 250 ms (window blur, a dialog taking focus, or the dispatcher canceling the held key). `onEnd` ignores its end reason and checks only the elapsed time, so the cancel runs `closeLens` and the lens disappears. A cancel should take the keep-or-unfollow path, not count as a tap.
- evidence: read
- severity: low
- size: line
- cause: onEnd ignores end reason
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
