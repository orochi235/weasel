# Findings: core.core.viewport (blind reviewer)

## A coast that starts outside `viewBounds` teleports to the boundary in one frame, even on an axis it was not thrown along
- where: packages/core/src/core/viewport/useDecayLoop.ts:94-119 (tick, boundary branch)
- scenario: `viewport.dragPan` with `inertia: { boundary: 'stop' | 'bounce' | 'spring', bounds }` seeds `initialPosition` from the live view (viewportDragPan.ts:156), and the drag itself is not held to `inertia.bounds`. Drag the view to x = -500 with `bounds.minX = 0`, then flick straight up (vx ≈ 0, vy large). On the first moving frame `newX = posX + 0 = -500 < minX`, so `dx = minX - posX = +500`: the camera jumps 500 world units sideways in one frame and `vx` is zeroed. The same happens when the throw is back toward the bounds (vx > 0 from x < minX): it is snapped to the edge instead of coasting in. The boundary test reads the position, not whether this frame's move crosses the edge; it should only clamp a move that crosses from inside to outside (or leave an already-outside axis alone unless moving further out).
- evidence: read (useDecayLoop.ts tick; viewportDragPan.ts:149-161 for how the coast is seeded)
- severity: medium

## `useNodeOverlayFrame` never subscribes to the scene, so its box and its null/non-null answer go stale after a scene edit
- where: packages/core/src/core/viewport/useNodeOverlayFrame.ts:89-109 (useNodeOverlayFrame)
- scenario: `Scene` is a mutable store (`scene.nodes` is read live; the hook takes the same `scene` object every render). The hook reads `worldBoxOf(scene, …)` during render only and has no subscription to scene changes. Move the node (undo, another tool, a pose animation feeding `effectivePose`) or delete it while the overlay is mounted and its parent does not re-render: the returned `box` (which the doc says to hand `paintToLocalUnits`) still describes the old pose, while `toScreen`/`toLocal` re-project live — the two disagree. A deleted node keeps returning a frame instead of `null`. `SceneGradientHandles` (ui-canvas) consumes it with no subscription of its own, so its handles drift from the node. Should subscribe (e.g. `useSyncExternalStore` on the scene's change channel) for the node and its ancestors.
- evidence: read (hook body; ui-canvas SceneGradientHandles.tsx:62 has no other scene hook); the drift is inferred, not run
- severity: medium

## `fitViewToBounds` warns on every call into a zero-area viewport, in production too
- where: packages/core/src/core/viewport/fitViewToBounds.ts:59-62 (fitViewToBounds)
- scenario: a canvas mounted hidden (`display: none`, a collapsed panel, a background tab measuring 0×0) whose owner refits on each content or size change calls `fitViewToBounds` repeatedly with zero dims; each call prints `console.warn` with no once-guard and no dev check. The kit's other invalid-view warning (`warnInvalidView`, zoomBounds.ts) is dev-only and once per session; this path answers the same "how loud is a recoverable bad input" decision differently and floods the console in shipped builds. The doc presents the zero-area case as a normal return (`currentView` unchanged, `animateToBounds` treats it as done), so it should not warn at all, or warn once in dev.
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
