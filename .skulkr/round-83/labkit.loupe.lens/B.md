## A Live lens's copy keeps every `id` of the trial it copies, so the page holds duplicate ids
- where: packages/labkit/src/loupe/lens/cloneSource.ts:83 (stillCopy)
- scenario: a story whose markup carries ids (an SVG `<linearGradient id>` referenced by `fill="url(#g)"`, a `<label for>`, `aria-labelledby`, or story code calling `document.getElementById`) is under a Live lens. `stillCopy` strips radio names, `form`, iframe `src` and `autoplay`, but not `id`, so the connected copy duplicates each id. `getElementById` and `url(#…)`/`for`/ARIA references resolve to the first element in tree order; wherever the lens layer precedes the trial, the trial's own lookups land on the inert, possibly stale copy (a gradient the story edits keeps rendering the copy's old stops until the next recopy; a label click focuses nothing). The copy should drop or rename ids (and rewrite references inside it) the way it neutralizes radio names.
- evidence: read (the tree-order effect is inference; it depends on where the surface container sits relative to the trial)
- severity: medium

## The Pixel grid draws a stale capture against the new factor until the next capture lands
- where: packages/labkit/src/loupe/lens/GridCanvas.tsx:84 (draw effect)
- scenario: a Pixels lens with Grid on is zoomed (factor 8 → 16). The capture effect waits `LENS_REST_MS` (250 ms) before asking again, but the draw effect re-runs at once with the new `factor` and the old `read`: `origin` is computed as `read.at * factor`, where `read.at` was the reticle's place in a capture box sized for the old factor, and `step = factor / read.dpr`. The grid is drawn at the wrong origin and pitch for the rest interval (and indefinitely if the new capture fails and nothing else changes it back, since only failure clears `read`). The draw should keep the factor the capture was taken at with the read, or clear `read` when the request changes.
- evidence: read
- severity: low

## LabLoupe offers `loupe.compare.menu` (key K) enabled while it has no compare menu
- where: packages/labkit/src/loupe/lens/LabLoupe.tsx:31 (createLensApi without `compare`); packages/labkit/src/loupe/lens/lensActionDefs.ts:219 (compareMenu action)
- scenario: in a plain lab, Alt+L then K. `compareMenu` is built with `on(...)` and no `enabled` rule, so it lists as enabled in the Loupe keymap and hint whenever a lens is up, but `createLensApi` gets no `compare` ref and `openCompareMenu` calls `refs.compare?.current?.(…)` → nothing happens. It should be disabled when the host gives no menu (as `loupe.compare.opposite` already is through `changes` with `NO_COMPARISON`).
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

<!-- done: 3 findings, files read: 33 -->
