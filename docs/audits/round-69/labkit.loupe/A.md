# labkit.loupe findings

## LensDifference schedules its capture with a bare setTimeout on a computed delay
- where: packages/labkit/src/loupe/lens/LensSlot.tsx:179 (LensDifference effect)
- scenario: the delay is `captureDelay()`, 0 on the first run and LENS_REST_MS after; the repo's rule is that a timer whose delay is not a constant waits through `after` (`@weasel-js/registry`), and `check:timers` is meant to fail exactly this shape. The delay is computed, so it bypasses the one place that guards computed delays.
- evidence: read
- severity: low

## GridCanvas schedules its capture with the same bare setTimeout on a computed delay
- where: packages/labkit/src/loupe/lens/GridCanvas.tsx:59 (GridCanvas capture effect)
- scenario: `setTimeout(…, captureDelay())`, the same shape as LensDifference's: a computed delay that skips `after`, so the timer rule is broken in two places, not one.
- evidence: read
- severity: low

## A Live lens's copy goes stale and lands off target when anything outside the lab body scrolls
- where: packages/labkit/src/loupe/lens/useLensRemeasure.ts:36 (useLensRemeasure); packages/labkit/src/loupe/lens/cloneSource.ts:95 (CloneCell.place / position)
- scenario: the lab sits in a page or shell that scrolls (a docs page holding a Lab, a scrollable app frame). The scroll is outside `.lk-lab__body`, so the capture listener on `body` never hears it and nothing re-renders. Each `LensSourceRequest.reticle` is in client px, computed only on render by `reticleClient`, so after the scroll it points where the reticle used to be. Any later `remeasure` (a trial change, a mutation) hit-tests that stale point in `rootAt`, and `position()` mixes the stale reticle with the root's new `layoutBoxOf` box, so the copy is offset by the scroll distance. A window `resize` re-renders and then remeasures; a scroll should do the same, and should be heard on the window/document as well as inside the body.
- evidence: read
- severity: medium

## Wheel pass-through scrolls a page whose root is `overflow: hidden`
- where: packages/labkit/src/loupe/lens/scrollByWheel.ts:7 (canMove)
- scenario: the overflow check is skipped for `ownerDocument.scrollingElement`, so a document styled `html, body { overflow: hidden }` (usual for a full-viewport lab or app) whose content is taller than the viewport is scrolled by `scrollByWheel` when the user wheels over a lens hit box. A real wheel can't scroll that viewport, so the page jumps only when the pointer is over a lens. The root should be held to the viewport's propagated overflow (from `html`, or from `body` when `html` is `visible`), barring `hidden` and `clip`.
- evidence: read
- severity: medium

## A clone source whose `root` matches an ancestor of the lens layer copies its own copies, recursively, every frame
- where: packages/labkit/src/loupe/lens/cloneSource.ts:96 (CloneCell.place / recopy, MutationObserver)
- scenario: `createCloneSource({ onFrame, root: '.lk-lab__body' })`, or any selector matching an element that holds the lens layer. `rootAt` skips hit elements inside a copy, but `closest(selector)` then returns the ancestor that holds the layer. `recopy` clones it, and the clone carries the lens layer with the cell's previous copy inside it. `replaceChildren` is a mutation in the observed subtree, so `schedule` marks the cell stale again and the next frame recopies. The DOM nests one level deeper on every frame, without bound. The root walk should reject a root that contains the slot, or the observer should ignore mutations inside `[data-lk-copy]`.
- evidence: read
- severity: low

## A click in a round lens's corners, outside the drawn circle, is picked as if it were inside the lens
- where: packages/labkit/src/loupe/useLoupe.ts:73 (insideLens), used at :243
- scenario: with the eyedropper on and `shape: 'circle'`, a click inside the lens's bounding box but outside its ellipse, where the host shows through, lands in `model.pick`. That reads what the magnified lens would show at that point, not the host pixel under the pointer. `insideLens` tests the box, but the bubble clips to `border-radius: 50%`. For a circle it should test the ellipse.
- evidence: read
- severity: low

## Turning `hollow` on while the lens is up invalidates nothing, so the host's hollow drawing never reaches the tiles until the lens moves
- where: packages/labkit/src/loupe/useLensDamage.ts:43 (useLensDamage report); packages/labkit/src/loupe/useLensReport.ts:23
- scenario: lens up and still, `hollow` flips false→true. `damage` becomes the surface, `report` is a new callback and reaches `useLoupe` through `options.onLens`, but `useLensReport` reports only on a change of the lens's JSON, which did not change, so the new `report` is never called. `was.current` stays null and no tile under the lens is invalidated: the tiles keep the pre-hollow picture (no magnified view) under a now-transparent bubble until the pointer moves. On that first move only the new box is invalidated (`was` was null), so any tile under the old box that redrew in between keeps the hollow drawing stale. It should invalidate the current lens box when the damage target appears.
- evidence: read
- severity: low

## Files read
packages/labkit/src/loupe/CanvasLoupe.tsx
packages/labkit/src/loupe/DomLoupe.tsx
packages/labkit/src/loupe/Loupe.less
packages/labkit/src/loupe/LoupeBubble.tsx
packages/labkit/src/loupe/LoupeGestures.tsx
packages/labkit/src/loupe/LoupePainter.tsx
packages/labkit/src/loupe/SceneLoupe.tsx
packages/labkit/src/loupe/SourceLoupe.tsx
packages/labkit/src/loupe/TrialLoupe.tsx
packages/labkit/src/loupe/canvasLens.ts
packages/labkit/src/loupe/hostLoupe.ts
packages/labkit/src/loupe/index.ts
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
packages/labkit/src/loupe/sourceLens.ts
packages/labkit/src/loupe/types.ts
packages/labkit/src/loupe/useLensDamage.ts
packages/labkit/src/loupe/useLensReport.ts
packages/labkit/src/loupe/useLoupe.ts

<!-- done: 8 findings, files read: 50 -->
