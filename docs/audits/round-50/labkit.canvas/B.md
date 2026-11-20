I couldn't write `.skulk/out/findings.md` because the permission was denied, so the whole findings document is below.

# Findings: labkit.canvas (round 50)

## The linked crosshair applies one y flip too many, so under `yAxis: 'up'` it is mirrored about the frame origin
- where: packages/labkit/src/canvas/LinkedCursor.tsx:18-25 (LinkedCursor), with packages/labkit/src/canvas/CameraInput.tsx:356-363 (pointerElsewhere)
- scenario: the pointer is published in world coordinates: `usePublishPointer` applies `frameLocalToWorld` to the frame-local result of `clientToWorld`. `pointerElsewhere` applies `frameLocalToWorld` again, so it returns frame-local, which is what its own doc says. LinkedCursor's comment assumes it was handed world, so it multiplies `y` by `frame.yDir` once more. That turns the point back into world, which it then projects through `camera.view.get()`, a frame-local view. Take a `<CanvasStack worldSpec={{ yAxis: 'up' }}>` beside a `<TrialOverview>`, with the pointer over world (10, 50) on the overview. The stack's crosshair is drawn where world (10, −50) is; it should sit on (10, 50). Under `yAxis: 'down'` the extra flip changes nothing, which is why no test catches it. `packages/labkit/src/overview/TrialOverview.tsx:288-291` makes the same extra flip, so the overview's crosshair is mirrored the same way.
- evidence: read. I traced all three `frameLocalToWorld` applications. No test covers a linked cursor under `yAxis: 'up'`; the only crosshair tests are TrialOverview.test.tsx:123,131.
- severity: medium

## A two-finger pan stops dead at the zoom bound: `clampZoomAbout` reads the pinch's pan as part of its zoom
- where: packages/labkit/src/canvas/cameraView.ts:47-62 (clampZoomAbout), called from packages/labkit/src/canvas/CameraInput.tsx:166 (useCameraView `set`). CameraInput.tsx:305 hands `createTouchZoomAction` an unclamped range.
- scenario: core's touch zoom (`touchZoom.ts:78-84`) sends one view per frame that both zooms and pans: it zooms about the old centroid, then translates by how far the centroid moved. `clampZoomAbout` assumes `prev → next` is a pure zoom about one fixed screen point. It solves for that point using the whole translation difference, pan included, then re-anchors at the clamped scale. Suppose the camera is at `maxZoom` (32) and the fingers drag 100 px while spreading very slightly (factor 1.01). Then `s1 = 32.32`, `clamped = 32 = s0`, and the result is `x = prev.x + px/s0 − px/s0 = prev.x`: the pan is thrown away completely. Finger jitter at either bound makes the pan alternately freeze and move. The same thing happens at `minZoom` while pinching in. When a frame crosses the bound, only part of the pan survives. Expected: the pan still applies, and only the scale is held.
- evidence: read (worked through the arithmetic with the formulas in both files)
- severity: medium

## Raising `minZoom` (or lowering `maxZoom`) on a live camera makes its next pan jump the zoom about the top-left corner
- where: packages/labkit/src/canvas/cameraView.ts:52 (clampZoomAbout, the `s0 === s1` branch), via CameraInput.tsx:155-158 and 166 (useCameraView)
- scenario: a stack opens at zoom 1 with `minZoom` 0.1, and the user zooms out to 0.2. The prop then changes to `minZoom={0.5}`, so `bounds` becomes [0.5, 32]. The range only widens for views placed from outside, and 0.2 came from the camera's own `set`. On the next drag-pan, `prev` and `next` both have scale 0.2, `clamped` is 0.5, and the branch returns `{ ...next, scale: 0.5 }` with the translation unchanged. That is a 2.5× zoom about screen (0, 0) on what was a pan gesture, so the content leaps away from the pointer. Expected: a pan stays a pan, or the clamp is anchored, as in the zoom branch.
- evidence: read
- severity: low

## Files read
packages/labkit/src/canvas/CameraInput.tsx
packages/labkit/src/canvas/CameraWheelContext.ts
packages/labkit/src/canvas/CanvasStack.less
packages/labkit/src/canvas/CanvasStack.stories.tsx
packages/labkit/src/canvas/CanvasStack.tsx
packages/labkit/src/canvas/CanvasStackContext.ts
packages/labkit/src/canvas/LinkedCursor.less
packages/labkit/src/canvas/LinkedCursor.tsx
packages/labkit/src/canvas/Orbit.less
packages/labkit/src/canvas/Orbit.tsx
packages/labkit/src/canvas/Stage.less
packages/labkit/src/canvas/Stage.tsx
packages/labkit/src/canvas/camera.ts
packages/labkit/src/canvas/cameraGestures.ts
packages/labkit/src/canvas/cameraRegistry.ts
packages/labkit/src/canvas/cameraTouch.less
packages/labkit/src/canvas/cameraView.ts
packages/labkit/src/canvas/cameraZoom.ts
packages/labkit/src/canvas/canvasCoords.ts
packages/labkit/src/canvas/hostBox.ts
packages/labkit/src/canvas/index.ts
packages/labkit/src/canvas/orbitZoom.ts
packages/labkit/src/canvas/useLayerScheduler.ts
packages/labkit/src/canvas/useThemeColors.ts
packages/labkit/src/canvas/worldSpec.ts

<!-- done: 3 findings, files read: 25 -->