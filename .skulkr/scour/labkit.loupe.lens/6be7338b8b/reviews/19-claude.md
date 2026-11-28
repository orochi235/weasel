## GridCanvas redraws an old capture at the new factor, so the grid and blend tint sit misaligned until the next capture lands
- where: packages/labkit/src/loupe/lens/GridCanvas.tsx:84 (GridCanvas, draw effect)
- scenario: Pixels lens at factor 8 with Grid on; press `=` (factor 16). The draw effect re-runs at once on `factor`, but `read` still holds the 8× capture: its `at` (reticle within a patch sized size/8) and its mask. `origin = width/2 - read.at.x * 16 * sd` lands a whole interior-width off, and the old mask is tiled at the new step, so lines and tint are drawn over the wrong pixels for LENS_REST_MS (250 ms) until the new capture resolves. The same happens when a Follow reticle moves. It should keep drawing the grid at the factor `read` was captured for, or clear until the matching capture arrives.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/GridCanvas.tsx
- size: line
- cause: draw uses live factor with a stale capture
- confidence: likely

## Difference view stays blank, with no reason given, for a Pixels source that is available but has no `capture`
- where: packages/labkit/src/loupe/lens/LensSlot.tsx:139 (LensDifference)
- scenario: a host offers `sources.pixels` whose `status()` is `true` but omits `capture`, which `LensSource` types as optional. The effect returns early (`!pixels?.capture`), `said` stays null, so `reason` is null: the canvas shows empty and no `.lk-lens-reason` explains it. The chrome also shows no reason, since `shownSource` reports Pixels as shown. It should say the source cannot capture, as it does for an unavailable one.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/LensSlot.tsx, packages/labkit/src/loupe/lens/lensSource.ts
- size: line
- cause: missing capture method not treated as unavailable
- confidence: sure

## A Live lens over a framed (isolated) story shows an empty frame
- where: packages/labkit/src/loupe/lens/cloneSource.ts:23 (rootAt), packages/labkit/src/loupe/lens/cloneSource.ts:89 (stillCopy)
- scenario: the reticle aims at a story rendered in an `<iframe>` inside `.lk-trial__body`. `rootAt` uses the outer document's `elementsFromPoint`, which stops at the iframe element and does not follow into the frame as `intoFrames` does for the wheel pass-through. The trial body is copied, and `stillCopy` strips the copy's iframe `src`/`srcdoc`, so the lens shows a blank frame instead of the story under the reticle. The wheel path follows the same point into the frame (`useWheelPassThrough` → `intoFrames`), so the two paths answer differently about what lies under a lens.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/cloneSource.ts
- size: function
- cause: hit test does not descend into frames
- confidence: likely

## A copy of a trial holding custom elements runs their live behavior again and loses their shadow content
- where: packages/labkit/src/loupe/lens/cloneSource.ts:212 (CloneCell.recopy)
- scenario: a trial containing an autonomous custom element with an attached (non-clonable) shadow root. `root.cloneNode(true)` upgrades the clone once connected, so its constructor and `connectedCallback` run a second time (timers, fetches, global listeners), which `stillCopy` says it takes out of a copy. The shadow root is not cloned, so the element shows empty or re-renders from its initial state, not as the trial shows it. The copy is redone on every mutation under the root, so this repeats.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/cloneSource.ts
- size: design
- cause: cloneNode upgrades custom elements and skips shadow roots
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
