# Audit round 70 — labkit.loupe (blind reviewer)

## A round Split lens's seam hit box takes presses outside the visible lens
- where: packages/labkit/src/loupe/lens/lensHitBoxes.ts:66 (hitBoxesOf), packages/labkit/src/loupe/lens/compare.ts:115 (seamHit)
- scenario: a circle lens in Split view with its seam dragged toward an edge (say `seam` 0.1). `hitBoxesOf` pushes a `lens-seam` box with `round: false`, a 2×`SEAM_GRAB` column spanning the interior's full bounding-box height, and `seamHit` likewise only tests the body's bounding rect. At x = 0.1·width the circle covers only a short middle band, so most of that column lies outside the lens: over the trial content beneath, with the seam itself clipped away by the slot's `clip-path: ellipse(...)`. A press there lands on the `.lk-lens-hit` seam div (pointer-events: auto), reaches the lens dispatcher, and the seam layer claims it as an exclusive `loupe.seam` drag. The trial under it never gets the press, and the seam moves when the user pressed outside the lens. The seam's box and `seamHit` should be clipped to the body's shape, as the body's own box already is with `data-round`.
- evidence: read
- severity: low

## `createCloneSource` drops a frame when two sources share one `useFrameSchedule`
- where: packages/labkit/src/loupe/lens/useFrameSchedule.ts:13, packages/labkit/src/loupe/lens/cloneSource.ts:172 (flush / want)
- scenario: `useFrameSchedule` keeps only the last function handed to it before the frame (`next.current = run`). `createCloneSource` documents `onFrame` as "useFrameSchedule's", and both are exported. A host that builds two clone sources over one schedule (a Live lens and a second clone-backed kind, say) and then has both request a frame before it fires loses the first source's `flush`. That source's stale copy is never recopied, and its canvases are not repainted until something requests again. `LabLoupe` uses only one source, so it does not hit this. Either the schedule should queue each distinct function, or the option should say it must not be shared.
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

<!-- done: 2 findings, files read: 50 -->
