## animateToBounds into a viewport with no area returns true but never calls onDone
- where: packages/core/src/core/viewport/useViewAnimation.ts:197 (animateToBounds)
- scenario: `animateToBounds(bounds, { width: 0, height: 300 }, { onDone })` before the canvas is measured. `fitViewToBounds` warns and hands back `current`; `fitted !== current` is false so `animate` is skipped, yet the call returns `true` ("it fit, the move is under way"). The caller's `onDone` never fires, so a caller sequencing on it (a tour step, a promise wrapper) hangs, and `false` — the documented "nothing moves" answer — is not given either. Should either return `false` or call `onDone` when nothing moves.
- evidence: read
- severity: medium

## useDecayLoop coasts forever on a NaN or infinite velocity
- where: packages/core/src/core/viewport/useDecayLoop.ts:144 (start) and :89 (tick)
- scenario: `start({ velocity: { vx: NaN, vy: 0 }, onTick })` (or `Infinity`, e.g. from a velocity computed over a sub-ms or bad timestamp span by a caller's own tracker). `speed < minSpeed` is false for NaN/Infinity in `start`, and in every `tick` friction keeps it NaN/Infinity, so the rAF loop never ends and calls `onTick(NaN|Infinity, …)` every visible frame, writing a non-finite pan each time; `onEnd` never fires. `checkInertia` validates friction and minSpeed (ruled 2026-11-19 because each "coasted forever") but not the velocity, which reaches the same hang. Should treat a non-finite velocity as no coast (call `onEnd`) or throw.
- evidence: read
- severity: medium

## useNodeOverlayFrame's fallback mapping is shared across node ids, so a stale toScreen maps through another node
- where: packages/core/src/core/viewport/useNodeOverlayFrame.ts:89 (mapping)
- scenario: a consumer keeps `toScreen` from the frame for node A (e.g. inside a rAF loop with a thunk `view`). `nodeId` changes to B and renders invertible, so the insertion effect stores B's projection in the one `lastInvertible` ref. A is then deleted: A's `toScreen` finds `project()` null and falls back to `lastInvertible`, which is B's mapping, so A's overlay jumps onto B instead of holding A's last position as the docs promise ("keep the last mapping that had an inverse").
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

<!-- done: 3 findings, files read: 23 -->
