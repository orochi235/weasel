## container.scroll drops a container's z scroll offset on every wheel step
- where: packages/core/src/interactions/actions/defaults/containerScroll.ts:160 (containerScrollAction.invoker.run)
- scenario: `ScrollOffset` carries an optional `z` (`scrollOffsets.ts` compares and stores `held.z`). A container scrolled to `{ x: 0, y: 40, z: 25 }` (a 3D host, or any caller of `scene.scroll.set`) gets a wheel tick: `run` builds `to = { x, y }` from `from` and calls `scene.scroll.set(hit.id, to)`, which replaces the whole offset, so `z` drops to 0 and the content jumps along z. It should carry `from.z` through (`{ ...from, x, y }`).
- evidence: read
- severity: medium

## container.scroll moves a scaled container's content by world units, not its own
- where: packages/core/src/interactions/actions/defaults/containerScroll.ts:158 (containerScrollAction.invoker.run)
- scenario: `by` is the wheel delta in world units (`wheelPan` at the view's scale). It is added to `scene.scroll`, an offset in the frame the container gives its children, and clamped against `scrollRange`, which `scrollRange` measures in the container's own frame. For a container whose pose scales its frame (scale 2), one wheel tick moves its content twice as far on screen as the same tick pans the viewport, and a 0.5-scaled one moves it half as far. The delta needs converting through the container's world-to-local linear part, as `scrollRange` already does for the range.
- evidence: inference (read the code path; did not run a scaled container)
- severity: low

## container.scroll can scroll a nested container that is scrolled out of its parent's view
- where: packages/core/src/interactions/actions/defaults/containerScroll.ts:86 (scrollablesAt)
- scenario: the walk tests every non-hidden scrollable container against `at` with its scrolled view pose, but never requires `at` to fall inside the ancestors' boxes. A scrollable child scrolled out past its scrolling parent's bounds (where the parent's overflow area does not show it) still counts as "shown" at a point outside the parent, becomes `innermost`, and the wheel scrolls a container the user cannot see instead of passing to the viewport pan. A hit should also require each scrolling ancestor to contain `at`.
- evidence: inference (did not confirm the renderer clips scroll containers' content)
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

<!-- done: 3 findings, files read: 17 -->
