## A clone source's copy is `inert`, so the `'interior'` probe can never land on it
- where: packages/labkit/src/loupe/lens/cloneSource.ts:122 (CloneCell constructor)
- scenario: a host mounts `<LensOverlay sources={{ live: createCloneSource(...) }} renderReadouts={...}>` (both exported) and its readout finds the element under the reticle with `probeUnderLens(el, 'interior', () => elementsFromPoint(...))`, as forge's `topmostIn` does. Lens.less stands the interior and every descendant up to `pointer-events: auto` for that probe, but the HTML spec has hit testing treat an inert subtree as `pointer-events: none` whatever CSS says. So the probe never returns an element of the copy: a Token or Contrast readout over a Live clone lens reads nothing, or reads what lies beneath the lens layer. It should land on the copied story element the lens shows.
- evidence: read (inert hit-testing behavior is from the spec, not run)
- severity: medium
- fix: packages/labkit/src/loupe/lens/cloneSource.ts, packages/labkit/src/loupe/lens/Lens.less
- size: line
- cause: `inert` used to block interaction, which also removes the copy from hit testing
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

<!-- done: 1 findings, files read: 33 -->
