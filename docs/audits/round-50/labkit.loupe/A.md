# Findings: labkit.loupe (round 50)

## The clone source's copy joins the story's radio groups, unchecking the story's own checked radio
- where: packages/labkit/src/loupe/lens/cloneSource.ts:123 (CloneCell.recopy)
- scenario: a Live lens (LabLoupe's default source) over a trial whose body holds `<input type="radio" name="size" checked>` outside any `<form>`. `root.cloneNode(true)` copies the checked radio and `replaceChildren` connects it in the same document (the lens layer is portaled into the surface container), with the same name and the same null form owner, so it is in the same radio group; per HTML, a checked radio becoming connected sets every other radio of its group unchecked. The story's real radio loses its selection the moment the lens copies it, and again on every recopy (each mutation under the root). `inert` does not take the copy out of the group. The same live clone also re-runs `<iframe>` loads and `autoplay` media inside the lens. The copy should not be live form state (strip `name`, or clone into an inert document/shadow tree).
- evidence: read
- severity: medium

## A Follow lens zoomed while its pointer rests, then pinned, keeps a reticle the size of the old factor
- where: packages/labkit/src/loupe/lens/lensScene.ts:262 (setLensOps), lensActionDefs.ts:235 (pinOps)
- scenario: a lens on Follow, pointer still; press `=` (or drag the rim zoom). `setLensOps` resizes the reticle's committed `reticle.pose` to the new patch, but a Follow reticle is shown through `createLensApi.follow`'s `scene.overrides.hold()`, which still holds the pose sized for the old factor, and nothing re-holds it until the next hover move. The reticle keeps outlining the old patch; pressing `p` then runs `keepHeldOps`, committing that held, old-size pose as the pinned reticle, so the pinned reticle no longer marks what the body magnifies. The factor write should re-size the held pose too (or pin from `reticleAt`).
- evidence: read
- severity: medium

## A loupe's `mode`, `factor`, `minFactor` and `maxFactor` are read once at mount; later prop changes are dropped
- where: packages/labkit/src/loupe/useLoupe.ts:153 (useLoupe → createHostLoupeModel)
- scenario: `<TrialLoupe mode={pixel ? 'pixel' : 'vector'} maxFactor={cap}>` re-rendered with new values. `useResolvedLoupe` re-resolves `options`, but `modelRef.current ??= createHostLoupeModel(options, …)` copies `mode`/`factor`/`minFactor`/`maxFactor` into `createLoupeModel` once (packages/loupe/src/model.ts:104 closes over `opts`), and nothing calls `setMode` or re-clamps afterwards. The lens keeps the first mode and bounds; a `source` added after mount (which `resolveLoupe` forces to `'pixel'`) leaves `loupe.mode`, and so `CanvasLoupe`'s choice, on the first value.
- evidence: read
- severity: medium

## `createLensApi` restarts lens ids at `lens-0`, colliding with lenses already in a host-owned scene
- where: packages/labkit/src/loupe/lens/lensApi.ts:77,112 (createLensApi / add)
- scenario: `LensOverlayProps.scene` is documented as host-owned and possibly outliving the overlay, and `createLensApi` is exported (index.ts:44). A host that keeps its `LensScene` across a remount and builds a new api over it: `next` starts at 0, so the first `add()` emits `addLensOps(scene, 'lens-0', …)` inserting `lens-0:body`/`:reticle`/`:leader`, ids the scene already holds, instead of a new lens. Ids should be minted past whatever `lensesOf(scene)` already holds.
- evidence: read
- severity: medium

## `createLensApi` subscribes to the scene and never unsubscribes
- where: packages/labkit/src/loupe/lens/lensApi.ts:85 (createLensApi)
- scenario: the unsubscribe from `scene.subscribe(...)` is discarded and the api has no dispose. Every api built over a long-lived host scene (a remount; StrictMode's double-invoked `useState` initializer at LabLoupe.tsx:31) leaves a listener walking its `holds` on every scene change for the scene's whole life.
- evidence: read
- severity: low

## Turning `hollow` off while a hollow lens is up leaves its last box's tiles undamaged
- where: packages/labkit/src/loupe/useLensDamage.ts:20 (useLensDamage)
- scenario: a `<TrialLoupe hollow>` on a tiled surface, lens up, then `hollow` flips to false. `damage` becomes null, so the new `report` never invalidates `was.current`; `useLensReport` does not re-report an unchanged lens either. The tiles under the box the host drew its hollow view into are never redrawn, so that drawing stays on the surface (now under a painted lens, and in place once the lens moves). Damage for `was.current` should be flushed when `damage` goes away.
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

<!-- done: 6 findings, files read: 50 -->
