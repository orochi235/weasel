# Audit round 71 — labkit.loupe — blind reviewer findings

## A canvas-stack loupe never resamples its color while the stack animates under a still aim
- where: packages/labkit/src/loupe/TrialLoupe.tsx:57-64 (useLoupeSampling)
- scenario: a `<TrialLoupe>` with no `render`/`sceneView`/`source`/`hollow` inside a `<CanvasStack>` whose layers are `timed` (an instrument animating from its own loop), with the pointer held still. `subscribeResample` is built only from a resolved `source` (`resolved ? … : undefined`), so on the stack path it is `undefined`, and `useLoupe` only resamples on an aim (useLoupe.ts:227-230). `CanvasLoupe` keeps redrawing the lens every frame, so the lens shows the new pixels, but `onColorChange` stays on the color from the last pointer move. The stack publishes exactly the signal needed, `CanvasStackSurface.ticks` ("the frames after each of which the stack repaints its timed layers", CanvasStackContext.ts:20-21). No file in `loupe/` reads it (grep `\.ticks` in labkit/src finds only TrialOverview). It should be used as `subscribeResample` when `surface` is the sampler's input.
- evidence: read
- severity: medium

## `<SourceLoupe>` reads its `CanvasSource` without retaining it, so a captured (WebGL) source is blank when used on its own
- where: packages/labkit/src/loupe/SourceLoupe.tsx:29-51 (SourceLoupe)
- scenario: `CanvasSource.retain` is documented as "a captured source has no frame while nobody holds it, so anything reading one … holds it for as long as it reads" (packages/loupe/src/canvasSource.ts:69-72). `SourceLoupe` is exported (index.ts:99) and documented as working on "any canvas … 2D or WebGL". It calls `drawSourceLens`, which reads `source.frame()` every frame, but never calls `retain()`. Only `TrialLoupe` retains (TrialLoupe.tsx:180-181). Mount `<SourceLoupe source={createCanvasSource(gl)} …/>` directly over a WebGL canvas made without `preserveDrawingBuffer`, with the host calling `source.capture()` after each draw: `capture()` copies nothing because nothing holds the source, `frame()` is `null`, the lens stays clear, and the source logs its "read while nothing holds it" warning. It should hold the resolved source for as long as it is mounted, the way `TrialLoupe` does while the lens is visible.
- evidence: read
- severity: medium

## `<LoupeGestures>` registers on the camera's registry for the first commit even when its host is not the camera's element, and the "two loupes" warning fires falsely
- where: packages/labkit/src/loupe/LoupeGestures.tsx:100-109 (useOnCameraElement), :123
- scenario: `useState(camera !== null)` assumes the loupe is on the camera's element until the post-commit effect checks. Take a `<TrialLoupe hostRef={innerRef}>` on a host inside a `<Stage>` that is not the stage's element. On the first commit it renders `<LoupeDispatch ownDispatcher={false}>`. That registers `loupe.aim`/`leave`/`peek`/`magnify` on the camera's registry, displacing any loupe really on the camera, since registrants stack newest-live. It also adds a token to `loupesOn(registry)`. Only then does the effect flip to its own dispatcher. If a second loupe on another non-camera host mounts in the same commit, or a real on-camera loupe is already mounted, `loupes.size === 2` and dev logs "two loupes in one camera: only the newest aims…". That is wrong: the setup is supported ("on any other host … it mounts a dispatcher of its own"), and the round-69 ruling in docs/unruled.md covers only two loupes *on* one camera.
- evidence: read
- severity: low

## A `render` loupe falling back to the camera, and a `sceneView` lens with a thunk view, read the camera once per React render, and nothing re-renders them when it moves
- where: packages/labkit/src/loupe/LoupePainter.tsx:71-75 (DomLoupe view fallback); packages/labkit/src/loupe/SceneLoupe.tsx:49
- scenario: with no `view` prop and no stack, `LoupePainter` passes `fromCameraView(camera.view.get(), camera.frame)`. `SceneLoupe` calls `view()` for a thunk. Both values are read only when `TrialLoupe` renders, and `TrialLoupe` renders only on a loupe change (an aim, peek, wheel or prop). It subscribes to neither the camera's view nor the scene view. When the camera pans or zooms under a still pointer (keyboard pan, a programmatic fly-to, the scene host's own animation), the lens keeps showing the region at the old camera until the pointer next moves. `SceneViewSource.view`'s doc ("A thunk is read fresh at every render, as a host's camera moves outside React") promises freshness that only holds if something triggers a render.
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
