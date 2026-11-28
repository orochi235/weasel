# routing.interactions — blind review findings

## A sticky rect that sticks to the page itself gets the page scroll counted with the wrong sign
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:96 (scrollersOf), :112 (stickyScrollerOf)
- scenario: the rect element (or an ancestor) is `position: sticky; top: 0` with no scrolling ancestor but the page, so `scrollersOf` hits `p === root` and builds `stickyScrollerOf(sticky, documentElement, …)`. On the stuck axis `moved()` reads `p.top - b.top`, but `documentElement.getBoundingClientRect().top` is `-scrollY`, so it moves with the page scroll, unlike an element scroller's border box (the only case the tests cover, handleDrag.test.ts:401–455). Scroll the page by `d` mid-drag: stuck, the box does not move on screen but `moved().y` drops by `d`, so `localOf` shifts the box down by `d` and every reported `y` is off by `-d`; not yet stuck, the box rides the scroll up by `d` but `p.top - b.top` stays constant, so no shift is applied and `y` is again off by `-d`. The loop then ends at root (`flatParentOf(root)` is null), so nothing else adds the page scroll back. Should be: the viewport's top/left (0) is the scroller's edge when the scroller is the root, or the root's scroll offset is added to the reading.
- evidence: read
- severity: medium
- size: line
- cause: root's client rect moves with its own scroll, unlike an element scroller's
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
