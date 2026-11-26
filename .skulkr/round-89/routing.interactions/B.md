# routing.interactions — round 89 findings

## A sticky rect element stuck to the viewport reads its scroll from the root's rect, which itself scrolls, so the correction comes out inverted
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:120 (stickyScrollerOf), reached from scrollersOf line 98 when `p === root`
- scenario: `<svg style="position:sticky; top:0">` in the page (no scrolling ancestor besides the viewport), pressed at page y=100 with scrollY=0. `scrollersOf` picks `stickyScrollerOf(svg, documentElement, …)`, whose stuck-axis `moved` is `p.top - b.top`. `documentElement.getBoundingClientRect().top` is `-scrollY`, so it moves with the page, unlike an element scroller's rect, which stays put while its contents scroll. When the page scrolls 50 during the drag (not yet stuck): b.top=50, p.top=-50, so `moved` stays −100 and the correction is 0, though the svg moved up 50. Scrolled to 200 (stuck at top 0): b.top=0, p.top=−200, `moved`=−200, delta −100, so `localOf` places the box at top 200 when it really sits at 0. Every `onMove` point is off by the scroll distance. For the root, the scroller's edge should be the viewport's (0), not the root's rect.
- evidence: read (traced the arithmetic; not run)
- severity: medium

## `transform-style: preserve-3d` (and `offset-path`) are missing from the fixed-containing-block test
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:58 (FIXED_HOLDERS / holdsFixed)
- scenario: a `position: fixed` rect element inside an ancestor with `transform-style: preserve-3d`, which per CSS Transforms 2 is its containing block, and that ancestor sits in a scrolled container. `holdsFixed` returns false for that ancestor, so `scrollersOf` walks to the top, decides the viewport holds the box, and returns no scrollers. Scrolling the container during the drag then moves the box with no correction, and the reported local points drift by the scroll distance.
- evidence: read
- severity: low

## `overflow: clip` is taken for a sticky box's scroll container
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:97 (scrollersOf)
- scenario: a sticky rect element whose parent has `overflow: clip`, inside a real scroller. `styleOf(p)?.overflow !== 'visible'` matches `clip`, so the sticky is resolved against the clip box, which neither scrolls nor makes the box stick. The real scroller then goes in as a plain `scrollerOf`, so the inset axis rides the full scroll even after the box sticks, and the points drift once it is stuck. Only `hidden`, `scroll` and `auto` make a scroll container.
- evidence: read
- severity: low

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
