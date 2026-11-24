# Findings: labkit.loupe.lens (round 82)

## LensZoom never hands the keys back when a press ends without a change or is canceled
- where: packages/labkit/src/loupe/lens/LensZoom.tsx:47 (write) and :71 (Slider props, no onCancel)
- scenario: `onRelease` (which re-activates the lens canvas's actions and focuses its input element) and `gesture.current += 1` run only from `onChange`. The Slider skips `onChange` when a drag ends where it began (`useThumbDrags.ts` `finish`: `if (commit) { if (!same) h.onChange(...) }`, `useRegionDrag.ts:88`), and a canceled drag (Escape, pointercancel) calls `onCancel`, which LensZoom does not pass. So pressing the zoom's thumb and releasing it in place, dragging back to the starting stop, or canceling a drag leaves `pressed` true and focus in the slider: Delete, undo and the lens keys no longer reach the lens canvas until the user clicks a lens. Should release on every press end, including no-change and cancel.
- evidence: read (LensZoom, ui Slider useThumbDrags/useRegionDrag)
- severity: medium

## A Follow lens's reticle hit box sits under the pointer, so every press goes to the lens canvas
- where: packages/labkit/src/loupe/lens/lensHitBoxes.ts:72 (hitBoxesOf)
- scenario: `hitBoxesOf` skips only Glass reticles. A Follow reticle is held centered on the pointer (`createLensApi.follow` via `loupe.follow` on every hover), and its hit box (`.lk-lens-hit`, `pointer-events: auto`) therefore always covers the point under the cursor. With a Follow lens up, a click meant for the story beneath lands on the reticle box instead: the lens canvas selects or starts moving the reticle, and the trial never sees the press. The comment on the Glass case ("the body takes the pointer there") shows the same reasoning applies: a reticle that tracks the pointer should take no input.
- evidence: inference (read hitBoxesOf, lensApi.follow, LensOverlay hit-box rendering, Lens.less)
- severity: medium

## Opening a quick lens records two undo entries
- where: packages/labkit/src/loupe/lens/lensActionDefs.ts:283 (openGlass)
- scenario: `openGlass` calls `api.add()`, which applies `addLensOps` as one `applyOps` entry, then applies the body move and `setAimOps(... 'glass')` as a second. After an F2 press, one Undo leaves a pinned lens beside its reticle instead of removing the quick lens; a second Undo is needed. The open should be one step.
- evidence: read
- severity: low

## Grid toggle reports "Grid needs…" while the lens still draws a grid in some cells
- where: packages/labkit/src/loupe/lens/LensChrome.tsx:50 (gridOk) vs packages/labkit/src/loupe/lens/LensSlot.tsx:247 (per-cell grid)
- scenario: Pixels source, factor 8, DPRs 1×|2×. The chrome requires `gridFits` for every request (`every`), so its Grid toggle reads `GRID_NEEDS`; `LensSlot` decides per cell, so the 1× cell (8/1 ≥ 8) draws a grid. The same question (does this lens show a grid) is answered two ways, and the label contradicts what the lens shows.
- evidence: read
- severity: low

## scrollByWheel stops at a body whose overflow propagated to the viewport, scrolling nothing
- where: packages/labkit/src/loupe/lens/scrollByWheel.ts:24 (canMove)
- scenario: Root `overflow: visible`, body `overflow: auto; height: 100%` with taller content (a common page setup). CSS propagates the body's overflow to the viewport, so the body itself is not a scroll container, but its computed `overflowY` still reads `auto` and `scrollHeight > clientHeight`. The walk reaches the body before `scrollingElement`, `canMove` says yes, `body.scrollBy` moves nothing, and the function returns true, so the original wheel is `preventDefault`ed and the page under the lens does not scroll. `canMove` should treat a body whose overflow was propagated (root `visible`) as not scrollable.
- evidence: inference (read; CSS overflow propagation)
- severity: low

## A copied form control with a `form` attribute joins the trial's own form
- where: packages/labkit/src/loupe/lens/cloneSource.ts:83 (stillCopy)
- scenario: `stillCopy` strips radio names, iframe sources and autoplay, but not the `form` attribute. A trial with `<input name="q" form="f">` outside `<form id="f">` gets a clone whose input resolves `form="f"` against the document and associates with the trial's form, so submitting it sends `q` twice, once with the copy's value. The copy should drop `form` as it drops radio names.
- evidence: inference (read; HTML form-owner rules)
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

<!-- done: 6 findings, files read: 33 -->
