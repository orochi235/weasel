## A sticky ancestor stuck to the page scroll gets inverted scroll compensation in useHandleDrag
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:118 (stickyScrollerOf), routed there by scrollersOf:95 (`p === root`)
- scenario: a handle inside a `position: sticky; top: 0` toolbar whose scroller is the document (`p === root`). `stickyScrollerOf` reads `p = documentElement.getBoundingClientRect()`, whose top is `-scrollY`, so it moves with the page scroll. While stuck the box stays put on screen (`b.top` constant), but `moved.y = p.top - b.top = -scrollY - inset` changes by the scroll, so a wheel scroll of 100px mid-drag reports every later point 100px off. While not yet stuck, `b.top = offset - scrollY` and `p.top - b.top = -offset` stays constant, so the scroll that does move the box goes uncompensated. For a scroller that is an overflow element, `p.top` stays fixed on screen and the formula is right. The document's scrollport is the viewport (rect origin 0,0), so the root case should measure against that, not against the root element's box.
- evidence: read
- severity: medium
- size: line
- cause: root element's border box used as the viewport scrollport
- confidence: likely

## `overflow: clip` ancestor taken as the scroller a sticky box sticks in
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:95 (scrollersOf)
- scenario: a sticky box with an ancestor set to `overflow: clip`, and a scrolling container further up. `clip` does not make a scroll container, so the box sticks to the scroller further up. The test `overflow !== 'visible'` stops at the clip ancestor instead and builds `stickyScrollerOf(sticky, clipAncestor)`. Its scroll is 0, and the relative rect it reads no longer tracks the real scroller, so a scroll mid-drag is compensated wrongly. The test should skip `clip` the way it skips `visible`, on both axes.
- evidence: read
- severity: low
- size: line
- cause: scroll-container test treats clip as scrolling
- confidence: likely

## useHandleDrag reports `moved: false` for a release whose local point changed through scrolling
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:182 (onPointerDown, `away`)
- scenario: the user presses a handle, wheel-scrolls the container mid-drag without moving the pointer, then releases. `localOf` adjusts for the scroll, so `onEnd.point` differs from the press point and any `onMove` sent it there. But `moved` compares only raw client coordinates, so it reads `false`, and a commit-on-end consumer treats the edit as a stray click and drops it. `moved` should compare local points, or count the scroll.
- evidence: read
- severity: low
- size: function
- cause: moved compares client coords, not local
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
