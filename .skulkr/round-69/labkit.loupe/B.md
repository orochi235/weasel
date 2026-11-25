# Audit round 69 — labkit.loupe

## createLensApi places and follows lenses in frame px, ignoring the camera LensOverlay draws the scene through
- where: packages/labkit/src/loupe/lens/lensApi.ts:139 (createLensApi `toFrame`, used by `add` and `follow`; also `lensClient` at :57)
- scenario: `LensOverlayProps.attachment` is documented for "a host attaching lenses to a pane passes that pane's camera", and `LensOverlay` draws, picks and hit-boxes the lens scene through `attachment.view()`. But `createLensApi` turns a client point into scene coordinates with `clientToCanvas(frame, …)` alone, and `lensClient` turns scene poses back with `canvasToClient` alone; neither knows the view. With a pane camera at zoom 2 panned by (100, 0), `add()` at the pointer puts the reticle at frame px, which the overlay then shows at 2·x+100, so the new lens is not where the pointer was, and every `follow` hover holds the reticle away from the pointer by the same transform. `lensClient` likewise reports a client point that is wrong by the view. Expected: scene points are taken through the inverse of the attachment's view (the api needs the attachment, or the frame contract has to exclude a non-identity attachment).
- evidence: read
- severity: medium

## A split lens's seam is hit-tested at a world-rounded x but drawn and hit-boxed at a screen-rounded x
- where: packages/labkit/src/loupe/lens/compare.ts:109 (seamHit) vs packages/labkit/src/loupe/lens/lensHitBoxes.ts:68 and LensSlot.tsx:235
- scenario: `splitRects` rounds `interior.width * seam` to a whole unit. The drawn seam and its `lens-seam` hit box apply it to the interior in screen px; `seamHit` (the seam layer's `hitTest`, which is what routes the press to `loupe.seam`) applies it to the body pose in world units and then compares against a grab of `SEAM_GRAB / scale`. Under an attachment view with scale 8, a body 20.3 world units wide (162.4 screen px) at seam 0.5 is drawn at screen 81 but hit at world 10 = screen 80, and in the worst case the rounding is 0.5 world = 4 screen px, the whole grab: a press on the visible seam lands on the seam hit box, `seamHit` misses, and the drag moves the body instead of the seam. Expected: both round in the same space (or neither rounds).
- evidence: read
- severity: low

## Two loupes inside one camera register their actions on one id, so only the newest one ever aims
- where: packages/labkit/src/loupe/LoupeGestures.tsx:87 (LoupeGestures, camera branch) with packages/labkit/src/loupe/TrialLoupe.tsx:190
- scenario: `OwnLoupeDispatch` exists, per its comment, "so two loupes under one provider do not stack their actions on one id", and outside a camera each loupe gets its own `InputScope`. Inside a camera (`<CanvasStack>`, `<Stage>`), `TrialLoupe` wraps the gestures in `<CameraScope>`, which joins the camera's scope rather than making one, and `LoupeGestures` registers `createLoupeActions(input, …)` straight on the camera's registry. Two `<TrialLoupe>`s in one stack (say, a hollow one plus a vector one, or two instruments' overlays on one stack) both register `loupe.aim` / `loupe.leave` / `loupe.peek` / `loupe.magnify`. Registrants for an id stack with the newest live, so the dispatcher drives only the second loupe's `input`; the first never aims, peeks or zooms until the second unmounts. The same question gets two answers: a scope of its own off a camera, a shared id on one. Expected: per-loupe ids or a per-loupe scope on the camera path too.
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

<!-- done: 3 findings, files read: 50 -->
