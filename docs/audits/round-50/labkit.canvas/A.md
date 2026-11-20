# Audit round 50 — labkit.canvas

## LinkedCursor flips y twice under `yAxis: 'up'`, drawing the crosshair mirrored about the frame's origin
- where: packages/labkit/src/canvas/LinkedCursor.tsx:18-25 (LinkedCursor), with packages/labkit/src/canvas/CameraInput.tsx:356-363 (pointerElsewhere)
- scenario: the pointer store holds the instrument's world (`usePublishPointer` applies `frameLocalToWorld` to the frame-local point; `CameraInput.test.tsx` "publishes the pointer in the instrument's world" asserts `{x:20,y:-15}` for a yAxis-up stack). `pointerElsewhere` applies `frameLocalToWorld` again, so it already returns the *frame-local* point, as its own doc says. `LinkedCursor`, whose comment claims `pointerElsewhere` "hands back the instrument's world", multiplies `y` by `yDir` a third time, turning it back into world, and projects that through the frame-local camera view. With `worldSpec={{ yAxis: 'up' }}`, zoom 2 and the pointer over an overview at world (20,-15), the stage's crosshair lands at screen y = -30 instead of 30. y-down frames are unaffected (yDir = 1), which is why tests pass. `TrialOverview.tsx:288-291` repeats the same extra flip against `pointerElsewhere`, so the contract is answered two ways: the doc says frame-local, both callers treat it as world.
- evidence: read
- severity: medium

## `clampZoomAbout` rescales a pan about the host's top-left when the view sits outside the range
- where: packages/labkit/src/canvas/cameraView.ts:45-50 (clampZoomAbout), reached from packages/labkit/src/canvas/CameraInput.tsx:164-171 (useCameraView set)
- scenario: the doc says "A pan (equal scales) passes through", but when `s0 === s1` and that scale is outside [min, max], the function returns `next` with only its scale replaced, keeping `x`/`y`. That zooms about screen (0,0). It happens when the view is out of range at the moment of a pan: say `maxZoom` is 32, the user wheels to 20 (its own `set`, so the range is not widened to cover it), and then the caller lowers `maxZoom` to 8. On the next plain drag, `viewport.dragPan` hands `set` a view at scale 20, it comes back at 8 anchored on the host's top-left corner, and the content jumps away from the pointer mid-drag instead of panning. What should happen: the pan passes through, or the clamp anchors about the drag point or the host middle, not the corner.
- evidence: read
- severity: low

## CanvasStack's backing density reads the global `window.devicePixelRatio`, not the element's own window
- where: packages/labkit/src/canvas/CanvasStack.tsx:97 (useMeasuredBox)
- scenario: the effect takes `win = el.ownerDocument.defaultView` and uses it for the resize listener and `embedScale(win)`, whose doc depends on "CSS zoom on the frame … already reaches the frame's devicePixelRatio". The density, though, is computed from the module's global `window.devicePixelRatio`. A stack portalled into an iframe (or any other document) under CSS zoom or on a differently-scaled frame gets the top window's ratio. That loses the frame's zoom factor, so its canvases come out soft (or oversized). It should read `win?.devicePixelRatio ?? 1`, as the rest of the effect does.
- evidence: read
- severity: low

## An inline `worldSpec` repaints every CanvasStack layer on every render
- where: packages/labkit/src/canvas/CanvasStack.tsx:160 (frame memo), packages/labkit/src/canvas/useLayerScheduler.ts:55-57
- scenario: `frame` is memoized on the `worldSpec` object's identity, so `<CanvasStack worldSpec={{ yAxis: 'up' }} …>` (the form the package's own tests and trials use) gives a new `frame` on every render. `useLayerScheduler` marks every layer dirty whenever `frame` changes, so any parent render (a clock tick, an unrelated state change) redraws every layer, including the static ones the stack exists to spare. The camera and stack contexts change too, re-rendering every consumer. `view` is deliberately keyed on its numbers for exactly this reason (line 141 comment), and the frame is not. It should memo `frame` on `origin.x`, `origin.y` and `yAxis`, plus the size.
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

<!-- done: 4 findings, files read: 25 -->
