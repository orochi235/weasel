# routing.interactions — blind review findings

## A sweep never reaches the items between its last move and the release point
- where: packages/routing/src/interactions/sweep/sweep.ts:146 (createSweepAction → start → onEnd)
- scenario: a fast flick across a row of toggles where the `pointerup` arrives at a client point past the last `pointermove` (coalesced moves; pointerup is not guaranteed to share the last move's coordinates) → `onEnd` ignores its `ctx` and calls `run.end('commit')` without `travel(end.world)`, so the items between the last move and the release are never entered. The doc promises "an item a fast drag crossed between two moves is entered too". The other drags in this area read the release point: carry `step(e)`s on `onEnd`, handleDrag reports `localOf` of the up event.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/sweep/sweep.ts
- size: line
- cause: release point not traveled on commit
- confidence: likely

## containsComposed ignores slot assignment, so a slotted item's drag doesn't preempt a surface inside a shadow root
- where: packages/routing/src/interactions/elementAt.ts:21 (containsComposed)
- scenario: a web component whose shadow root holds the dispatcher surface (`<div class="list"><slot></slot></div>`), with the items as light-DOM children slotted into it. An item opens a pointer session on itself → `heldWithin(id, surface)` calls `containsComposed(surface, item)`: `surface.contains(item)` is false, the item's root is the document with no `host`, so the answer is false and the surface's own drag doesn't yield, even though the item is laid out inside it. `surfaceAt` in carry.ts has the same blind spot when it decides which of two nested surfaces is innermost. handleDrag's `flatParentOf` in this same area already walks `assignedSlot`, so "inside" means two different things here.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/elementAt.ts
- size: function
- cause: walks shadow hosts, not the flat tree (assignedSlot)
- confidence: likely

## Sweep can't find items slotted into a surface or held in the surface's own shadow root
- where: packages/routing/src/interactions/sweep/sweep.ts:91 (itemAt)
- scenario: (a) the surface is a custom element whose items live in its own shadow root → `elementAt(surface)` hit-tests in the surface's root (the document), gets back the surface itself (retargeted), and the loop `el !== surface` exits at once → null, so nothing sweeps. (b) the surface is inside a shadow root and its items are slotted light-DOM children → `surface.contains(el)` is false → null. In both cases `enabled` answers NotApplicable for every press. The walk up `parentElement` also stops at a shadow-root boundary instead of following the flat tree.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/sweep/sweep.ts, packages/routing/src/interactions/elementAt.ts
- size: function
- cause: non-composed contains/parentElement in hit walk
- confidence: likely

## handleDrag treats an `overflow: clip` ancestor as a sticky box's scroller
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:94 (scrollersOf)
- scenario: a sticky header (`top: 0`) holding a handle, inside a wrapper with `overflow: clip`, inside a scrolling pane. `overflow: clip` doesn't create a scroll container, so the header sticks to the pane. The test `styleOf(p)?.overflow !== 'visible'` stops at the clip wrapper, builds `stickyScrollerOf(sticky, wrapper)`, measures `wrapper.top - box.top`, and then gives the real pane a plain `scrollerOf`. Once the header sticks, the pane's scroll is counted on top of the box's offset relative to the wrapper, so the reported local y drifts by the scroll distance while the header sits still on screen.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/handleDrag/handleDrag.ts
- size: line
- cause: scroll-container test counts `clip` as a scroller
- confidence: likely

## handleDrag's containing-block test misses `transform-style: preserve-3d`
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:58 (holdsFixed)
- scenario: a `position: fixed` handle panel inside an ancestor with `transform-style: preserve-3d` (and no transform) in a scrolling pane. Chromium makes that ancestor the panel's containing block (CSS Transforms 2), so the panel scrolls with the pane. `holdsFixed` doesn't list it, so `scrollersOf` walks past to the viewport and returns no scrollers. A scroll mid-drag then shifts the reported local coordinates by the scroll distance.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/handleDrag/handleDrag.ts
- size: line
- cause: incomplete containing-block property list
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

<!-- done: 5 findings, files read: 14 -->
