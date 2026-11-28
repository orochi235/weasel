## A Ctrl+wheel (trackpad pinch) over a lens scrolls the story beneath instead of zooming the page
- where: packages/labkit/src/loupe/lens/useWheelPassThrough.ts:40 (onWheel)
- scenario: the pointer is over a lens hit box above a story with a scroller and no wheel handler of its own; the user pinches on a trackpad, which arrives as `wheel` with `ctrlKey: true`. Nothing cancels the copy, so `scrollByWheel(beneath.el, copy)` scrolls the scroller by `deltaY` and returns true, and the hook calls `e.preventDefault()` on the original. The story scrolls and the browser's pinch zoom is suppressed. A trusted Ctrl+wheel never scrolls a box, and the hook's own comment promises to do what a browser does for a trusted wheel. Expected: with `ctrlKey` set, skip `scrollByWheel` and leave the original uncanceled unless the copy was canceled.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/useWheelPassThrough.ts, packages/labkit/src/loupe/lens/scrollByWheel.ts
- size: line
- cause: modifier ignored when emulating a native scroll
- confidence: likely

## Shift+wheel over a lens scrolls the story vertically where a browser scrolls it horizontally
- where: packages/labkit/src/loupe/lens/scrollByWheel.ts:61 (scrollByWheel)
- scenario: on Windows or Linux, a mouse wheel with Shift held arrives with `deltaY ≠ 0`, `deltaX = 0` and `shiftKey: true`. The browser scrolls that horizontally. `scrollByWheel` reads `wheelPixels(wheel)` as given, so over a lens a horizontal-only scroller (`overflow-x: auto`, no vertical room) does not move at all, and a box that can move both ways moves vertically. Expected: swap the axes for a `shiftKey` wheel that has no `deltaX`, as the platform does for a trusted wheel.
- evidence: read
- severity: low
- size: line
- cause: shift axis swap not emulated
- confidence: likely

## A scroller with `overscroll-behavior: contain` at its end still hands the lens's wheel on to the page
- where: packages/labkit/src/loupe/lens/scrollByWheel.ts:56 (scrollByWheel / canMove)
- scenario: a story has an inner list with `overscroll-behavior: contain` (or `none`), scrolled to its bottom, inside a page that can scroll. A trusted wheel down over the list scrolls nothing, because the list blocks scroll chaining. Through a lens, `canMove` is false for the list, so the loop goes on to `parentOf(el)` and scrolls the outer scroller or the document. Expected: the walk stops at an element whose computed `overscroll-behavior-x/y` is not `auto` on the moving axis, once that element is a scroll container.
- evidence: read
- severity: low
- size: function
- cause: scroll chaining ignores overscroll-behavior
- confidence: likely

## A wheel over a lens never reaches content inside an open shadow root beneath it
- where: packages/labkit/src/loupe/lens/useWheelPassThrough.ts:13 (onWheel); packages/labkit/src/loupe/lens/intoFrames.ts:20 (intoFrames)
- scenario: a story renders its scroller, or a canvas with a wheel-zoom listener, inside a web component's open shadow root. `elementFromPoint` retargets to the shadow host. `intoFrames` descends into frames but never into `host.shadowRoot.elementFromPoint`, so the copy is dispatched on the host. It cannot reach listeners inside the shadow tree: dispatching on the host never enters its shadow tree. `scrollByWheel` then starts its walk at the host and skips the inner scroller. Under a lens, the story's zoom and scroll stop working. `scrollByWheel`'s `parentOf` already climbs out of shadow roots, so a walk starting inside one is clearly meant to happen. Expected: follow the point down through open shadow roots, as is done for frames.
- evidence: read
- severity: low
- fix: packages/labkit/src/loupe/lens/intoFrames.ts
- size: function
- cause: hit test does not descend into shadow roots
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
