## useDecayLoop never ends a coast started with a non-finite velocity
- where: packages/core/src/core/viewport/useDecayLoop.ts:157 (start) and :86 (tick)
- scenario: `start({ velocity: { vx: NaN, vy: 0 }, onTick })` (a velocity tracker fed one NaN delta, or an Infinity from a huge delta over a tiny dt). `speed < minSpeed` is false for NaN and for Infinity, both in `start` and in every `tick`, and friction never brings NaN or Infinity down. The loop requests a frame forever, calling `onTick(NaN, …)` / `onTick(Infinity, …)` each frame, and `onEnd` never fires. `checkInertia` validates `friction` and `minSpeed` but not `velocity`. It should treat a non-finite velocity as no throw: end at once and call `onEnd`.
- evidence: read
- severity: medium

## animateToBounds returns true but never calls onDone when the viewport has no area
- where: packages/core/src/core/viewport/useViewAnimation.ts:196 (animateToBounds)
- scenario: `animateToBounds(bounds, { width: 0, height: 300 }, { onDone })`. `fitViewToBounds` returns `current` unchanged, the `fitted !== current` guard skips `animate`, and the call returns `true`, which tells the caller a move was started. `opts.onDone` ("Fires when the target is reached") never runs. A caller that chains its next step on `onDone`, or treats `true` as "a move is underway", waits forever. It should either return `false` or call `onDone`, since the target, the current view, has been reached.
- evidence: read
- severity: low

## Files read
packages/core/src/core/viewport/checkInertia.ts
packages/core/src/core/viewport/clampView.ts
packages/core/src/core/viewport/clientToWorld.ts
packages/core/src/core/viewport/createVelocityTracker.ts
packages/core/src/core/viewport/fitSize.ts
packages/core/src/core/viewport/fitViewToBounds.ts
packages/core/src/core/viewport/homeView.ts
packages/core/src/core/viewport/interpolateView.ts
packages/core/src/core/viewport/parallax.ts
packages/core/src/core/viewport/sceneNodeClientRect.ts
packages/core/src/core/viewport/screenSlop.ts
packages/core/src/core/viewport/useCanvasSize.ts
packages/core/src/core/viewport/useDecayLoop.ts
packages/core/src/core/viewport/useFitOnce.ts
packages/core/src/core/viewport/useNodeOverlayFrame.ts
packages/core/src/core/viewport/useVelocityTracker.ts
packages/core/src/core/viewport/useViewAnimation.ts
packages/core/src/core/viewport/view.ts
packages/core/src/core/viewport/viewTransform.ts
packages/core/src/core/viewport/viewportWorldRect.ts
packages/core/src/core/viewport/wheelHandler.ts
packages/core/src/core/viewport/zoomAt.ts
packages/core/src/core/viewport/zoomBounds.ts

<!-- done: 2 findings, files read: 23 -->
