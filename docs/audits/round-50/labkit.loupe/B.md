# Audit round 50: labkit.loupe

## A loupe's `mode`, `minFactor` and `maxFactor` are read once at mount; later prop changes never reach the model
- where: packages/labkit/src/loupe/useLoupe.ts:154 (useLoupe), with packages/labkit/src/loupe/hostLoupe.ts:24 (createHostLoupeModel)
- scenario: `<TrialLoupe mode={m} maxFactor={k}>`. `modelRef.current ??= createHostLoupeModel(options, …)` builds the model from the first render's `options`. `createLoupeModel` copies `mode` and closes over `opts.minFactor`/`opts.maxFactor` (packages/loupe/src/model.ts:104). Nothing re-syncs them when `useResolvedLoupe` hands `useLoupe` a new `options` object. So toggling `mode` from `'vector'` to `'pixel'` leaves `loupe.mode`, which `TrialLoupe` passes to `LoupePainter`/`CanvasLoupe`, on `'vector'`. Raising `maxFactor` leaves the wheel clamped to the old ceiling. Adding `render` or `sceneView` after a pixel-mode mount also hands `DomLoupe` a `'pixel'` mode, although `resolveLoupe` promises that a render loupe is always vector. `factor` is documented as the opening magnification; `mode` and the bounds are not, and `resolveLoupe` recomputes them on every change only to have them dropped.
- evidence: read
- severity: medium

## The lab lens API places lenses in lab-body px, but the overlay draws and reads them in surface-container px
- where: packages/labkit/src/loupe/lens/lensApi.ts:89 (createLensApi `toBody`), packages/labkit/src/loupe/lens/lensApi.ts:34 (lensClient), against packages/labkit/src/loupe/lens/LensOverlay.tsx:171 (reticleClient)
- scenario: `createLensApi` converts client points with `clientToCanvas(refs.body.current, …)`, where `body` is `.lk-lab__body`, and `lensClient` converts back with `canvasToClient(body, …)`. `LensOverlay` paints the same scene through `VIEWPORT_ATTACHMENT` (identity) onto `.lk-lens-layer`, which is portaled into `surface.getContainer()` with `inset: 0`, and `reticleClient` converts with `canvasToClient(layer, …)`. Under a lab's own surface the container is the over layer inside the body, so the two frames coincide. Under an outer host surface (`LabSurface`'s `outerSurface`, the `LentTopBuffer` path) the container is the host's, and its origin is not the body's. There, a lens added at the pointer (`api.add`) or moved by Follow (`api.follow`) is drawn offset by the body's offset within the container. `lensClient` and `reticleClient` also give two different client points for the same reticle, so the source request's `reticle` disagrees with `lensClient`'s.
- evidence: read (the outer-surface container's position is inferred from LabSurface.tsx and LentTopBuffer.tsx, not run)
- severity: medium

## A hollow lens's damage keeps its last box in client px, so after the host scrolls the next move invalidates the wrong region
- where: packages/labkit/src/loupe/useLensDamage.ts:28 (useLensDamage `report`)
- scenario: a hollow lens on a tiled surface. `was.current` stores the lens box converted to client px at report time. `useLensReport` reports only when the lens changes in host px, and a scroll or a layout shift of the host moves the drawn lens without changing that. On the next aim, `damage.invalidateBox(was.current)` invalidates the box where the lens was on screen before the scroll, not where it was last drawn. If the surface does not repaint those tiles on scroll for some other reason, the ring stays behind as a ghost in the tiles it really covered. The fix is to keep `was` in host px and convert both boxes at report time.
- evidence: read (whether the tiled surface already repaints on scroll was not checked)
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
