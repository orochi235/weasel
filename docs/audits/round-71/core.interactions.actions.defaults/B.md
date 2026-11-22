# Audit round 71 — core.interactions.actions.defaults

## Two-finger pinch zoom does not stop a running pan coast, so the view keeps sliding under the fingers
- where: packages/core/src/interactions/actions/defaults/touchZoom.ts:47 (createTouchZoomAction → start)
- scenario: a pan with `inertia` (hand tool) is flung and released, so `view.decay` is coasting; a two-finger pinch begins before it stops. `viewportDragPan.start` calls `view.stopDecay?.()` because "the last fling's coast would otherwise fight this pan", but `touchZoom.start` does not. The decay loop keeps adding its per-tick delta to the view each frame while the pinch also sets it, so the content drifts away from the fingers. The loop also tracks its own position from `initialPosition` (useDecayLoop.ts:149) for its boundary test, which the pinch's zoom/pan invalidates, so the boundary stop lands at the wrong place. The press-catches-the-coast decision is answered one way for drag pan and the other for pinch.
- evidence: read (viewportDragPan.ts:82; view.ts:61-79 — `set` stops an animation but not a decay; useDecayLoop.ts:136-154)
- severity: medium

## Wheel pan, wheel/trackpad/key zoom and container scroll leave a running pan coast going
- where: packages/core/src/interactions/actions/defaults/viewportWheelPan.ts:28 (run); packages/core/src/interactions/actions/defaults/viewportZoom.ts:173 (scaleBy) and :187 (in/out)
- scenario: during an inertia coast from a hand-tool fling, the user Cmd+wheels or pinches on the trackpad. `view.set` stops a view animation (`stopIfExternal`) but not the decay, so after the zoom the coast continues adding world-unit deltas computed from the pre-zoom scale (velocity was converted with the drag's `base.scale`), so the post-zoom view slides by a distance scaled for the old zoom, and the decay's internal position (for `boundary`) no longer matches the view. Expected: an external camera input ends the coast, as a press does in `viewportDragPan`.
- evidence: read (view.ts:61-64, useDecayLoop.ts:144-149, viewportDragPan.ts:147-160)
- severity: low

## Container scroll takes the wheel for a container covered by a non-scrollable node painted above it
- where: packages/core/src/interactions/actions/defaults/containerScroll.ts:84 (scrollablesAt)
- scenario: a scrollable `tileGrid` container with a later sibling (e.g. a large rectangle or a floating panel node) drawn over part of it. Wheeling over the covering node: `scrollablesAt` only records scrollable hits and ignores whether a later-painted non-scrollable node covers the point, so `innermost` stays the grid and the grid scrolls under the overlay, instead of the wheel going to the viewport pan as it would for the node the user is actually pointing at.
- evidence: read (inference: no occlusion test anywhere in the walk)
- severity: low

## Context-menu pointer hit reports `selected-body` when the hit has no id, while selecting nothing
- where: packages/core/src/interactions/actions/defaults/contextMenu.ts:42 (menuHitFor)
- scenario: `hitAt` returns `{ bodyTarget: 'unselected-body' }` with `id` undefined (a hit-tester that classifies but does not name the node). `target` is undefined, so no `select` is returned and the selection is left as it was, yet the menu is opened with `bodyTarget: 'selected-body'`. The menu then offers selection actions (delete, group…) that act on the previous, unrelated selection, not the shape right-clicked. Expected: fall back to `unselected-body`/the raw hit when nothing can be selected.
- evidence: read
- severity: low

## Files read
packages/core/src/interactions/actions/defaults/cancelAll.ts
packages/core/src/interactions/actions/defaults/containerScroll.ts
packages/core/src/interactions/actions/defaults/contextMenu.ts
packages/core/src/interactions/actions/defaults/copySubtree.ts
packages/core/src/interactions/actions/defaults/index.ts
packages/core/src/interactions/actions/defaults/lockedReach.ts
packages/core/src/interactions/actions/defaults/nudgeSteps.ts
packages/core/src/interactions/actions/defaults/requiresOperands.ts
packages/core/src/interactions/actions/defaults/segmentUnder.ts
packages/core/src/interactions/actions/defaults/sliceOps.ts
packages/core/src/interactions/actions/defaults/toolActivate.ts
packages/core/src/interactions/actions/defaults/toolResetToDefault.ts
packages/core/src/interactions/actions/defaults/touchZoom.ts
packages/core/src/interactions/actions/defaults/undoRedo.ts
packages/core/src/interactions/actions/defaults/viewportDragPan.ts
packages/core/src/interactions/actions/defaults/viewportWheelPan.ts
packages/core/src/interactions/actions/defaults/viewportZoom.ts

<!-- done: 4 findings, files read: 17 -->
