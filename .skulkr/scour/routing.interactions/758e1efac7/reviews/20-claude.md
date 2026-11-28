## A sticky rect element in a page-scrolled document reports its drag points shifted by the page scroll
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:123 (stickyScrollerOf)
- scenario: the rect element (or an ancestor) is `position: sticky; top: 0` and the page itself scrolls, so `scrollersOf` reaches `p === root` and builds `stickyScrollerOf(sticky, documentElement, …)`. On the inset axis, `moved()` returns `p.top - b.top` where `p` is `documentElement`, whose `getBoundingClientRect().top` is `-scrollY` and moves with the scroll. Scroll the page by `d` during the drag. While the box is stuck (it stays put on screen), `now.y - scrolled.y` comes out as `-d`, so `localOf` moves the box down by `d` and every reported point is off by `d`. While the box is still riding the scroll (it moves up `d`), both rects move together, the delta is 0, and the points are off by `d` the other way. For the root, the scroller's edge should be the viewport (0), not the document element's rect. A non-root scroller's rect does not move with its own scroll, which is why that case works.
- evidence: read
- severity: medium
- size: line
- cause: documentElement rect used as the viewport edge
- confidence: likely

## `overflow: clip` on an ancestor is taken as the sticky box's scroller
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:101 (scrollersOf)
- scenario: a sticky rect element sits inside a wrapper with `overflow: clip`, inside a scrolling container. The test `styleOf(p)?.overflow !== 'visible'` passes for `clip`, so the sticky correction is measured against the clip wrapper, which never scrolls. The real scroller further up is then pushed as a plain `scrollerOf` and `sticky` has already been cleared. When that container scrolls while the box is stuck, the drag treats the box as riding the scroll, and reported points drift by the scroll distance. `clip` (like `visible`) does not make a scroll container, so it should be skipped.
- evidence: read
- severity: low
- size: line
- cause: scroll-container test misses `clip`
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

<!-- done: 2 findings, files read: 14 -->
