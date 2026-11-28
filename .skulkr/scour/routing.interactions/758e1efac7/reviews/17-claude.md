# Findings: routing.interactions

## A sticky rect whose scroller is the page gets its scroll correction inverted: zero while it rides the scroll, minus the scroll once stuck
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:118 (stickyScrollerOf)
- scenario: An SVG handle sits in a `position: sticky; top: 0` header in an ordinary page, with no inner scroll container, so `scrollersOf` reaches `p === root` and pushes `stickyScrollerOf(header, documentElement, …)`. `moved()` returns `p.top - b.top`, where `p` is `documentElement.getBoundingClientRect()`, and that rect itself moves by `-scrollY` as the page scrolls. While the header is not yet stuck it rides the scroll, so `b.top` also moves by `-d`, the difference stays the same, and the correction is 0 when it should be `d`: points drift by the scroll. Once the header is stuck, `b.top` is fixed and `p.top` falls by `d`, so the correction is `-d` when it should be 0: a stuck header that never moved on screen reports its points off by the page scroll. The formula holds only for an inner scroller, whose border box stays put on screen while it scrolls. The tests cover only that case (handleDrag.test.ts:401-450). For the root, the scrollport is the viewport, so the reference rect should be the viewport origin (0, 0), not the root's border box.
- evidence: read
- severity: medium
- size: line
- cause: root element's rect used as the scrollport, but it moves with the page scroll
- confidence: likely

## `overflow: clip` is taken for a sticky box's scroll container
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:96 (scrollersOf)
- scenario: A sticky rect inside a `<div style="overflow: clip">`, which sits inside a real scroller. `styleOf(p).overflow !== 'visible'` holds for `clip`, so the sticky scroller binds to the clip box. `clip` makes no scroll container, though, so the box really sticks in the outer scroller. The outer scroller then gets a plain `scrollerOf`, which counts its full scroll even while the box is stuck, and the reported points drift by that scroll. The test should treat `visible` and `clip` (on both axes, e.g. `"clip visible"`) as no scroll container.
- evidence: read
- severity: low
- size: line
- cause: scroll-container test treats any non-visible overflow as scrolling
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
