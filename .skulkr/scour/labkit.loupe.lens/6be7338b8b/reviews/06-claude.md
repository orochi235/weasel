# Findings: labkit.loupe.lens

## A press on a lens in a multi-lens selection focuses the first selected lens, not the one pressed
- where: packages/labkit/src/loupe/lens/useFocusReports.ts:20 (report), :41 (end)
- scenario: lenses A and B both selected (Shift+click, or a marquee); the user presses a chrome toggle on A (focus → A), then presses B's body. The selection stays as it was, so `end` calls `report()`, which reports `scene.getSelection()[0]`, which is A. The lens actions keep landing on A even though the press was on B. The same happens when Shift+click adds B to [A]: the subscriber reports A, not the lens just clicked. The press handler already has `e.target.closest('.lk-lens-hit')` with `data-node`, which names the pressed lens.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/useFocusReports.ts
- size: function
- cause: focus derived from selection order instead of from the press target
- confidence: likely

## The Pixel grid draws the previous capture against the new factor and size until the next capture lands
- where: packages/labkit/src/loupe/lens/GridCanvas.tsx:79 (draw effect)
- scenario: a Pixels lens with Grid on, at 8×; the user zooms to 16× or resizes the body. The draw effect runs right away with the new `factor`/`w`/`h` but the old `read` (its `at`, `columns`, `mask` come from the capture taken for the old patch). It draws lines at the new step from an origin built from the old capture's `at` and tints mask cells indexed by the old capture's column count. The grid stays misplaced for at least `LENS_REST_MS` (250 ms) plus the capture's round trip, and stays misplaced if that capture fails, because a rejection or a `reason` reply only nulls `read` when it arrives. It should clear, or skip the draw, while `read` belongs to a different request.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/GridCanvas.tsx
- size: function
- cause: cached capture not keyed to the request it answered
- confidence: likely

## A clone source's copy loses every style it got from the root's ancestors
- where: packages/labkit/src/loupe/lens/cloneSource.ts:216 (CloneCell.recopy), packages/labkit/src/loupe/lens/Lens.less:221 (.lk-lens-copy)
- scenario: the copy is re-parented under `.lk-lens-copy` in the lens layer. Inherited properties (`color`, `font-*`, `color-scheme`, custom properties such as a per-pane theme's `--wzl-*`), and every rule whose selector goes through an ancestor of the root (`.lk-trial .x`, `[data-mode=dark] .x`), now resolve against the lens layer's ancestors instead of the trial's. A story whose text color, font or tokens come from its trial or pane wrapper shows up in the lens in the lab's colors and font, so the lens magnifies something the trial does not show. `root` is a documented option (any selector), which makes this broader than `.lk-trial__body`.
- evidence: read
- severity: medium
- fix: packages/labkit/src/loupe/lens/cloneSource.ts
- size: design
- cause: clone detached from its cascade context
- confidence: likely

## A clone of a padded or bordered content-box root is laid out wider than the original
- where: packages/labkit/src/loupe/lens/Lens.less:232 (.lk-lens-copy > *), packages/labkit/src/loupe/lens/cloneSource.ts:199 (CloneCell.position)
- scenario: the wrapper is sized to `root.offsetWidth × offsetHeight` (the border box), and `> * { width: 100%; height: 100% }` gives the cloned root that width as its *content* width under the default `box-sizing: content-box`. Take a root with `padding: 16px; border: 1px` (a custom `root` selector). The copy's border box is then 34px wider and taller than the original. Centered or right-aligned content, and anything placed in percent, shifts by up to 17px times the factor, so the reticle's point no longer lands on the center of the interior.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/Lens.less
- size: line
- cause: border-box size applied as content-box width
- confidence: likely

## paintDifference returns without clearing, so the Difference view keeps showing the previous diff with no message
- where: packages/labkit/src/loupe/lens/difference.ts:89 (paintDifference), packages/labkit/src/loupe/lens/LensSlot.tsx:166 (LensDifference run)
- scenario: `readBitmap` returns null (no 2d context for the scratch canvas, e.g. a context lost under memory pressure or an environment with no canvas backend). `paintDifference` returns 0 before touching `canvas`, and `LensDifference` then calls `say(null)`, so the reason is cleared and the canvas keeps the diff from the last reticle position or the last comparison. It presents that image as the current difference. Also, `!ctx` on the target returns `changed` without drawing.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/difference.ts, packages/labkit/src/loupe/lens/LensSlot.tsx
- size: function
- cause: failure path reported as success
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

<!-- done: 5 findings, files read: 33 -->
