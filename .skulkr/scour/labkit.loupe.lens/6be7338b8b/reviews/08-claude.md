# labkit.loupe.lens — blind review findings

## A press on a Follow lens's own body lands on its reticle, which the lens canvas still picks
- where: packages/labkit/src/loupe/lens/lensShapes.ts:46 (lensShapes, `labkit:lens-reticle` matches/silhouette)
- scenario: Set a lens to Follow (Alt+L, F) and move the pointer onto that lens's body. `loupe.follow` hears hover on the whole lab body, which holds the lens layer, so the reticle is held centered on the pointer, inside the body, and it paints above the body (it was inserted after it). Press the body to select or drag it: the press reaches the dispatcher through the body's hit box, and the canvas picks the topmost silhouette at that point, which is the Follow reticle. `lensShapes` gives it a silhouette for every aim but Glass. So the reticle gets selected and the drag writes `setPose` to it while the hold keeps overriding it: nothing visibly moves, and the body cannot be dragged at all while it is under the pointer. The press should take the body. `hitBoxesOf` already drops a Follow reticle's DOM box for this reason ("a box would take every press meant for the trial"), but the scene pick still answers for it. `held: 'optional'` on `loupe.follow` also keeps the reticle under the pointer throughout the drag.
- evidence: read (traced hover → `api.follow` → hold; pick order from insert order; no test covers pressing a Follow lens's body)
- severity: medium
- fix: packages/labkit/src/loupe/lens/lensShapes.ts
- size: line
- cause: Follow reticle left pickable in the scene
- confidence: likely

## A Live copy is magnified twice by any scale the lab body and the lens layer share
- where: packages/labkit/src/loupe/lens/cloneSource.ts:178 (CloneCell.position)
- scenario: Put a lab inside an element scaled by a CSS transform (`scale(0.5)`), or under a page zoom applied as a transform, so `layoutBoxOf(root).scale` is 0.5 for the trial body and the lens layer is scaled 0.5 too. `position` sets the copy's scale to `factor * scale.x` and its translate to `size.width/2 - local.x * kx`. Both are in the slot's own px, which that same ancestor scale already shrinks, so the copy shows at `factor * 0.5 * 0.5` on screen instead of `factor * 0.5 / 0.5`: half the magnification the reticle marks, and off-center by the same ratio. Only the part of `scale` not shared with the slot (a zoomed pane's own transform) belongs in `kx`, so the slot's own scale should be divided out. `lensApi`'s `frame` doc names this case: an ancestor transform scales the layer.
- evidence: read
- severity: low
- cause: root's client scale used where the scale relative to the slot is needed
- size: function
- confidence: likely

## The aim actions stay enabled when the lens already has that aim, unlike every other lens setting action
- where: packages/labkit/src/loupe/lens/lensActionDefs.ts:258 (lensLifeActions: pinned, follow, glass)
- scenario: With a Pinned lens current, `loupe.aim.pinned` is enabled: the palette and keymap list it as available, and firing it applies `setAimOps(... 'pinned')`, which returns `[]`, so it does nothing. Every action built with `set` reports `NotApplicable` when its write would change nothing (`changes(...)`). So "does this action do anything here" gets two different answers: Source: live on a live lens is disabled, but Aim: pinned on a pinned lens is not.
- evidence: read
- severity: low
- cause: aim actions built with `on`, skipping the no-change check
- size: function
- confidence: sure

## intoFrames maps a point into a frame with its horizontal scale on both axes
- where: packages/labkit/src/loupe/lens/intoFrames.ts:23 (intoFrames)
- scenario: An isolated story frame scaled unevenly (`transform: scale(1, 0.5)`, or a pane stretched on one axis). `scale` is `box.width / offsetWidth` = 1 and is used for `top` and `y` too, so a wheel under a lens is dispatched to the frame at twice the true y. It lands on the wrong element or misses the frame's viewport. The y axis should use `box.height / offsetHeight`.
- evidence: read
- severity: low
- cause: one scale for both axes
- size: line
- confidence: sure

## A new lens on a lab body narrower than its body hangs off the right edge
- where: packages/labkit/src/loupe/lens/lensApi.ts:72 (bodyBeside)
- scenario: The lab body (the region) is under 160px wide, e.g. a narrow sidebar layout or a small embedded lab. `region.left + half > region.right - half`, and geom's `clamp` returns `lo` when the bounds cross, so the body is centered at `left + 80` and runs past `right`, outside the lab body. The same happens vertically on a short body. It should center in the region when the region is smaller than the body.
- evidence: read (geom `clamp` checks `hi` first, then `lo`)
- severity: low
- cause: clamp with crossed bounds
- size: line
- confidence: sure

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

<!-- done: 5 findings, files read: 33 -->
