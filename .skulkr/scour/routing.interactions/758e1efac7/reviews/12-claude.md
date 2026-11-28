## useHandleDrag mis-compensates scrolling for a rect inside a sticky box that sticks to the viewport
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:118 (stickyScrollerOf), reached from scrollersOf at line 94 when `p === root`
- scenario: a handle's `<svg>` sits inside a `position: sticky; top: 0` header whose scroll container is the page (scrollersOf pairs the sticky box with `documentElement`). stickyScrollerOf reads the offset as `scroller.getBoundingClientRect().top - box.getBoundingClientRect().top`, but `documentElement`'s rect itself moves by `-scrollY` as the page scrolls, unlike a scroll container's rect, which stays put while its content scrolls. If the page scrolls 100px mid-drag while the header is stuck, the box has not moved on screen, but `moved().y` changes by −100, so `localOf` shifts the rect 100px down and every reported point is 100px off. While the header is not yet stuck, the delta comes out as 0 when it should be +100. What should happen: for the viewport, measure against the viewport's origin (0, 0), not against the root element's rect.
- evidence: read
- severity: medium
- size: line
- cause: root element's rect used as the viewport's
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

<!-- done: 1 findings, files read: 14 -->
