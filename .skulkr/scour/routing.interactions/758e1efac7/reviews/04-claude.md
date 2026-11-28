# routing.interactions — blind review findings

## A sticky ancestor that sticks to the page viewport has its scroll read off the root element's rect, which itself scrolls, so handle coordinates go wrong both while it is stuck and while it rides
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:120 (stickyScrollerOf), chosen at :97 (scrollersOf, `p === root`)
- scenario: a handle inside a `position: sticky; top: 0` toolbar with no scrolling ancestor but the page. `scrollersOf` reaches `p === root` and builds `stickyScrollerOf(sticky, root, …)`, whose `moved()` returns `p.top - b.top` with `p = documentElement.getBoundingClientRect()`. The root's rect top is `-scrollY`, so it moves with the scroll. While the toolbar is stuck (`b.top` constant), `moved.y` falls by the page scroll Δ and `localOf` shifts the box down by Δ although it never moved; while it is not yet stuck (box rides the scroll, `b.top` and `p.top` both fall by Δ), `moved.y` stays constant and the real Δ is never compensated. Either way a page scroll during the drag offsets every `onMove`/`onEnd` point by the scroll distance. For a non-root scroller the formula is right because that scroller's border box does not move when it scrolls its content; for the root the scrollport is the viewport (top/left 0), not the root element's box.
- evidence: read
- severity: medium
- size: line
- cause: root element rect used as the viewport scrollport
- confidence: likely

## `overflow: clip` is taken for the scroll container a sticky box sticks in
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:97 (scrollersOf)
- scenario: a sticky toolbar whose parent has `overflow: clip` (computed `overflow` is `"clip"` or `"clip visible"`, never `"visible"`) inside an `overflow: auto` pane. `clip` establishes no scroll container, so the toolbar sticks in the pane. The test `styleOf(p)?.overflow !== 'visible'` builds the sticky scroller against the clipping parent instead; its `p.left - b.left` stays constant, and the pane is then pushed as a plain `scrollerOf`, so while the toolbar is stuck a pane scroll is reported as moving the handle's space by the full scroll distance when it did not move.
- evidence: read
- severity: low
- size: line
- cause: scroll-container test treats clip as scrolling
- confidence: likely

## A carry's `onMove` reaches the source after the carry was canceled from inside that same move
- where: packages/routing/src/interactions/carry/carry.ts:133 (startCarry, onMove)
- scenario: a surface's `receive('enter' | 'move')` (a carry binding's action) or anything it triggers calls the carry's `cancel()` during `step(e)`. The session aborts, `onCancel` fires the leave and the source's `cb.onCancel`, then control returns to `onMove`, which still calls `cb.onMove?.(e)`: the source hears a move after its cancel and may re-show the drag preview it just tore down. The move should be skipped once `session.active` is false.
- evidence: read
- severity: low
- size: line
- cause: no active check after step
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
