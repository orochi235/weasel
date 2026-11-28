# routing.interactions — blind review

## useHandleDrag mis-tracks scroll for a sticky rect element whose scroller is the page (root)
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:118 (stickyScrollerOf), reached from scrollersOf:95
- scenario: `getRect` (or the default) names an element with `position: sticky; top: 0` whose nearest scroll container is the page, so `scrollersOf` reaches `p === root` and builds `stickyScrollerOf(sticky, root, …)`. `moved()` reads `root.getBoundingClientRect().top - box.top`. The root's border box moves with the page scroll (`top = -scrollY`), unlike an element scroller's box, which stays put. Once the box is stuck, `box.top` stays at the inset, so `moved().y = -scrollY - inset` changes with every scroll step, and `localOf` shifts the reported points by the scroll distance even though the box never moved. Before the box sticks, `box.top = offset - scrollY`, so `moved().y = -offset` stays constant and a box that is really riding the scroll is reported as fixed. For the root, the sticky formula should measure against the viewport (`0`/scrollport), not the root's border box.
- evidence: read
- severity: medium
- size: line
- cause: root's rect moves with scroll; formula assumes a stationary scrollport
- confidence: likely

## A sticky box's scroller is found by `overflow !== 'visible'`, so an `overflow: clip` ancestor is taken for its scroll container
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:95 (scrollersOf)
- scenario: a sticky rect element sits inside an `overflow: clip` wrapper, which is itself inside a real scroller. `clip` does not make a scroll container, so the box sticks in the outer scroller. The code sees overflow `clip` (not `visible`), builds the sticky scroller against the clip wrapper, and pushes a plain `scrollerOf` for the real scroller later. Every scroll of the real scroller is then counted as a ride, even after the box has stuck, so the reported points drift by the scrolled distance. (Computed `overflow` is also a shorthand. With `overflow-x: auto; overflow-y: visible`, the computed `overflow-y` is `auto`, but a shorthand that reads `"auto visible"`-style values isn't handled consistently across engines.) The test should be "is a scroll container" (`overflow-x`/`overflow-y` in `auto|scroll|hidden`).
- evidence: read
- severity: low
- size: line
- cause: "not visible" used as "scroll container"
- confidence: likely

## Sweep never reaches items rendered inside a shadow root under the surface
- where: packages/routing/src/interactions/sweep/sweep.ts:93 (itemAt)
- scenario: a surface's items are custom elements whose toggles live in their own shadow roots, with `keyOf` naming the inner toggle. `elementAt(surface, …)` hit-tests in the surface's own tree root, so the hit is retargeted to the shadow host. The walk climbs `parentElement` from the host toward the surface, so `keyOf` is never asked about the inner element. Nothing sweeps, and `enabled` reports NotApplicable for every press. carry's `surfaceAt` and pointerSession's `heldWithin` handle this boundary with `containsComposed`; sweep doesn't, so the same question gets two different answers.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/sweep/sweep.ts, packages/routing/src/interactions/elementAt.ts
- size: function
- cause: hit-test not descended through nested shadow roots
- confidence: likely

## Files read
packages/routing/src/interactions/browserReservedKeys.ts
packages/routing/src/interactions/carry/carry.ts
packages/routing/src/interactions/carry/index.ts
packages/routing/src/interactions/elementAt.ts
packages/routing/src/interactions/handleDrag/handleDrag.ts
packages/routing/src/interactions/keyHelpers.ts
packages/routing/src/interactions/pointerSession/index.ts
packages/routing/src/interactions/pointerSession/pointerSession.ts
packages/routing/src/interactions/pointerSession/swallowClick.ts
packages/routing/src/interactions/scratchKey.ts
packages/routing/src/interactions/sweep/index.ts
packages/routing/src/interactions/sweep/sweep.ts
packages/routing/src/interactions/thresholdDrag/index.ts
packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts

<!-- done: 3 findings, files read: 14 -->
