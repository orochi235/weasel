# routing.interactions — blind review findings

## A handle drag whose rect element is sticky to the page reports the page scroll backwards
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:114 (stickyScrollerOf), reached from scrollersOf:95 when `p === root`
- scenario: the rect element (or an ancestor) is `position: sticky; top: 0` and the page itself is the scroller, like a sticky toolbar holding an `<svg>` of handles. `scrollersOf` resolves the sticky against `p === root` and `stickyScrollerOf` reads the stuck axis as `p.top - b.top`, using `documentElement.getBoundingClientRect()` as the scrollport. The root's box is not the scrollport, though: its top is `-scrollY` and moves with the scroll, while the viewport stays put. If the page scrolls by Δ mid-drag before the box sticks, the box moves up by Δ, but `p.top - b.top` stays constant (both moved by Δ), so `localOf` reports y off by Δ. Once the box is stuck it stays put, but `p.top - b.top` changes by −Δ, so the reported point drifts by Δ in the wrong direction. For a sticky inside an overflow scroller (p's box fixed on screen) the same formula is right. It should measure against the viewport (`{left: 0, top: 0}`) when the scroller is the root.
- evidence: read
- severity: medium
- size: line
- cause: root's border box used as the scrollport
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
