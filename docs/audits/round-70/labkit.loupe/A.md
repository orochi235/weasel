# Audit round 70 — labkit.loupe

## Inside a camera, `<LoupeGestures>` drops `hostRef`: the lens's input comes from the camera's element, not the element it tracks
- where: packages/labkit/src/loupe/LoupeGestures.tsx:80 (LoupeDispatch), :110 (LoupeGestures); packages/labkit/src/loupe/TrialLoupe.tsx:86 (useLoupeHost)
- scenario: a `<TrialLoupe hostRef={paneRef}>` mounted inside a `<Stage>`/`<CanvasStack>` (so `CameraContext` is set) whose `paneRef` is not the camera's element. `useLoupeHost` picks `hostRef` as the tracked host (it ranks `hostRef` above the camera's), but `LoupeGestures` takes the camera branch, passes `enabled: false` to `useGestureDispatcher`, and the actions join the camera's dispatcher, which listens on `camera.element()`. So `hostRef` is never listened on: a pane outside the camera element never aims, and one inside it raises the lens (`pointer.over = true`) for hovers anywhere over the camera element, outside the pane, with aims measured against the pane's box. `LoupeGesturesProps.hostRef` is documented as "the element the dispatcher listens on — the same one the lens tracks"; it should either mount its own dispatcher when `hostRef` is not the camera's element, or `useLoupeHost` should not let `hostRef` win inside a camera.
- evidence: read
- severity: medium

## A press on a reticle lying over a Split lens's seam drags the seam instead of the reticle
- where: packages/labkit/src/loupe/lens/compare.ts:110 (seamHit), :130 (seamLayer.hitTest)
- scenario: lens A is in Split view; a pinned or Follow reticle (lens B's, or A's own, which sits wherever it was put) lies across A's seam strip. `hitBoxesOf` puts the reticle's hit box after A's body and seam in paint order, so the press lands on the reticle's box, but `seamLayer.hitTest` asks `seamHit`, which walks bodies only ("only the topmost body under the point counts") and never reticles, so it returns A's seam and claims the press `exclusive`, which (per `affordances/types.ts:133`) bars every binding not targeting the seam affordance, the reticle's move included. Dragging the reticle off that spot moves A's seam. `seamHit` should give up the point when any reticle or later body drawn above A covers it, as it already does for a body.
- evidence: read (the ranking of a layer claim against a node pick is inferred from the `strength` doc, not run)
- severity: medium

## `<LensOverlay>` does not re-render on a Follow hold: only `LabLoupe` subscribes to `scene.overrides`, so any other host's lenses lag their reticles
- where: packages/labkit/src/loupe/lens/LensOverlay.tsx:280 (LensOverlay); packages/labkit/src/loupe/lens/LabLoupe.tsx:36
- scenario: a host other than `LabLoupe` mounts the exported `<LensOverlay>` with a `createLensApi` api and a lens in Follow aim. `loupe.follow` moves the reticle through `scene.overrides.hold()`, which (per LabLoupe's own comment) bumps no scene version. `LensOverlay` subscribes only to `scene.subscribe`/`getVersion` and the attachment, so it does not re-render: `hitBoxesOf` (the reticle's hit box) and `reticleClient` (the point each `LensSlot`/source is asked to show) keep the pre-hold pose while the lens canvas draws the reticle following the pointer. `LabLoupe` papers over it with its own `useSyncExternalStore(scene.overrides.subscribe, …)`; the subscription belongs in `LensOverlay`, which is the component that reads `effectivePose`, so the same question is not answered per host.
- evidence: read
- severity: medium

## A clone copy is scaled by the root's x scale on both axes, so it misaligns vertically under a non-uniform scale
- where: packages/labkit/src/loupe/lens/cloneSource.ts:126 (CloneCell.position)
- scenario: a trial body shown under an ancestor `transform: scale(1, 0.5)` (`layoutBoxOf` reports `scale = {x:1, y:0.5}`). `local.y` is divided by `scale.y`, but `k = factor * scale.x` is used for the y offset and for the uniform CSS `scale(var(--lk-copy-k))`, so the copy is drawn twice as tall as the trial shows and the point under the reticle is not at the interior's center vertically. Should carry `scale.y` separately (a `--lk-copy-ky`) for the y offset and the scale.
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

<!-- done: 4 findings, files read: 50 -->
