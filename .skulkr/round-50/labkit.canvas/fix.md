- LinkedCursor and TrialOverview crosshairs flip y one time too many under `yAxis: 'up'` (A+B): fixed 3421e1ff05
- `clampZoomAbout` rescales a pan about the top-left corner when the view sits outside a narrowed zoom range (A): fixed 8897642815
- CanvasStack reads the top window's `devicePixelRatio`, not the element's own window's (A): fixed b3d3d3274e
- An inline `worldSpec` redraws every CanvasStack layer on each parent render (A): fixed 8e9352811f
- A two-finger pan stops dead at the zoom bound, because `clampZoomAbout` reads the pinch's pan as part of its zoom (B): fixed 0f5bc09e89. The pinch now clamps to the camera's live `zoomRange()` itself, about the old centroid and before it pans.
- Raising `minZoom` or lowering `maxZoom` makes the next pan jump the zoom about the top-left corner (B): duplicate of the A `clampZoomAbout` finding, 8897642815
- Linked crosshair y flip (B): duplicate of A, 3421e1ff05

Extra, found while fixing:
- In `packages/ui`, `SpanStrip.module.css` had a raw-px `font-size` that fails `check-design-tokens`, so `lint -w @weasel-js/labkit` failed at the frozen commit: fixed c90d2d3922
- In `apps/draw`, `Treemap.module.css` had a bare `font-variant-numeric` that fails `check:numeric` at the frozen commit: fixed e5d38b88f3
- Not fixed, outside this area: core's `watchDevicePixelRatio` watches only the global window, so a stack in an iframe still won't hear that frame's density change. Fixing it means adding a window parameter to core.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: LinkedCursor.test.tsx pass, cameraView.test.ts pass, camera.pbt.test.ts pass, cameraGestures.test.tsx pass, CanvasStack.test.tsx pass, CameraInput.test.tsx pass, Stage.test.tsx pass, TrialOverview.test.tsx pass, TrialOverview.density.test.tsx pass
- Unrun browser tests: none touched
- `npm run checks:gate`: pass ("all 32 passed")
- `npm run lint -w @weasel-js/labkit`: pass
- `@weasel-js/ui` has no lint script. Its change is covered by labkit's design-token check and the gate.
- `npm run typecheck:packages -- labkit`: pass
- Tree is clean apart from `.skulk/`

tally: 7 of 7 fixed, 2 extra fixed