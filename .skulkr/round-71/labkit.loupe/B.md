# Audit round 71 — labkit.loupe (blind reviewer)

## Live clone lens shows a scrolled scroller inside the trial at scroll position 0
- where: packages/labkit/src/loupe/lens/cloneSource.ts:137 (CloneCell.recopy), :158 (CloneCell.frame)
- scenario: a trial body holds a scrollable list scrolled down 400px; a Live lens is aimed at it. `root.cloneNode(true)` does not copy `scrollTop`/`scrollLeft`, and nothing afterwards sets them on the copy. `copyCanvases` is the only state carried across. Scrolling the inner list fires the capture-phase `scroll` listener in `useLensRemeasure`, which calls `place()`. The root is unchanged, so that only calls `position()`, and the copy's scroller stays at 0. So the lens shows the top of the list rather than what is under the reticle. Expected: the copy's scrollers mirror the originals, as its canvases already do.
- evidence: read
- severity: medium

## Live clone lens goes stale on input that doesn't change the DOM
- where: packages/labkit/src/loupe/lens/cloneSource.ts:72 (CloneCell.watch), :148 (schedule)
- scenario: typing into a text field, ticking a checkbox or choosing a `<select>` option under a Live lens changes the element's value or checkedness *property*. None of these is a DOM mutation, so the `MutationObserver` (childList/attributes/characterData) never fires, `stale` stays false and the copy keeps the value it had when cloned. `frame()` only re-copies canvases. The lens keeps showing the old text or check state until some unrelated attribute or child mutation forces a recopy. Expected: form state changes refresh the copy, for example by listening for `input`/`change` on the root or syncing control values in `frame()`.
- evidence: read
- severity: medium

## A clone copy's box keeps the root's old size and offset after a DOM change resizes or moves the root
- where: packages/labkit/src/loupe/lens/cloneSource.ts:158 (CloneCell.frame), :119 (position)
- scenario: a mutation inside the trial body changes the root's `offsetWidth`/`offsetHeight`, for example content growing a body that sizes to its content. Or a layout change outside the root moves its `left`/`top` with no window scroll or resize. The observer marks the copy stale and `frame()` → `recopy()` rebuilds it, but neither calls `position()`. So `--lk-copy-w/h/x/y` keep the old geometry. The copy's child is `width/height: 100%` of that stale box, so it is laid out at the old size and offset, and the reticle's point no longer lands at the lens center. `position()` only runs again on `update`/`remeasure` (a reticle move, scroll, resize or color-scheme change).
- evidence: read
- severity: low

## LoupeGestures registers a non-camera-host loupe on the camera's registry for its first commit, causing a false two-loupe warning and possibly removing a sibling's actions
- where: packages/labkit/src/loupe/LoupeGestures.tsx:104 (useOnCameraElement), :123 (LoupeGestures)
- scenario: `useOnCameraElement` starts `on` as `camera !== null` and only corrects it in a parent effect. Children's effects run first. So a `<TrialLoupe hostRef={ownDiv}>` inside a camera first mounts `<LoupeDispatch ownDispatcher={false}>`. That registers its `loupe.*` actions on the camera's shared registry and adds a token to `loupesOn(registry)`, and only after that does it flip to its own `InputScope`.
  - With two such loupes in one camera, or one beside a loupe that really is on the camera element, the token set reaches 2 on first commit. That fires the dev warning "two loupes in one camera" when the setup is valid.
  - The transient loupe registers the same action ids as the real camera-element loupe and then unregisters them. If the registry replaces by id, the real loupe's aim, peek and wheel actions can be gone after the flip.
  - Expected: decide on-camera before registering anything, for example with a layout effect, or by not registering until the comparison has run.
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
