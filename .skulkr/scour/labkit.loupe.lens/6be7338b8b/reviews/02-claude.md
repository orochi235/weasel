## closeLens drops a lens's hold only under Follow, but the quick lens holds a Glass body, so a quick-key tap close relies on the host api noticing the deletion
- where: packages/labkit/src/loupe/lens/lensActionDefs.ts:258 (closeLens), :345 (quick onEnd tap path)
- scenario: open a quick lens with F2 and hold it while the pointer moves (followMove → `api.follow(..., carried)` takes `scene.overrides.hold()` on the Glass lens's body), release, then tap F2 again while moving: the tap path calls `closeLens`, which calls `api.unfollow` only when `s.aim === 'follow'`; the quick lens is Glass, so the hold on the deleted body is never dropped by the actions. `createLensApi` happens to release it from its scene watch, but `LensActionApi`'s contract (and `lensApiFixture`, which has no watch) does not; any host api built to the contract keeps an override for a deleted node id. Holds are taken under any aim `follow()` is called with, so closeLens should unfollow whenever the lens may be held (or the tap path should call `api.unfollow(lensId)` as the drag path does).
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/lensActionDefs.ts
- size: line
- cause: hold release keyed on aim, not on whether a hold exists
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
