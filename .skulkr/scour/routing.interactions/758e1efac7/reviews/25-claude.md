# routing.interactions — blind review

## A sticky box held by the page's own scroll reads the root element's rect as its scroller, which moves with the page, so a page scroll mid-drag shifts the reported point
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:113 (stickyScrollerOf)
- scenario: the rect element (an `<svg>`, say) sits in a `position: sticky; top: 0` header whose nearest scroller is the viewport, so `scrollersOf` reaches `p === root` and builds `stickyScrollerOf(sticky, documentElement, …)`. On the stuck axis `moved()` is `root.getBoundingClientRect().top - box.top`. The root's rect is not the viewport: its top is `-scrollY`. While the header is stuck, a wheel scroll of `d` during the drag leaves the box where it is on screen, yet `moved().y` drops by `d`, so `localOf` adds `d` to every y it reports: the handle jumps by the scroll distance. While the header is still riding the scroll (not yet stuck), box and root move together, so `moved()` stays the same and the scroll is never subtracted, though the box did move by `d`. Both states are wrong. With a scroller element (not the root), the scroller's rect is fixed on screen and the same formula is right. The fix is to measure against the viewport's origin (0, 0) when `scroller` is the root.
- evidence: read
- severity: medium
- size: line
- cause: root's border box taken as the viewport's scrollport
- confidence: likely

## `overflow: clip` is taken as the scroller a sticky box sticks in, though it is not a scroll container
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:91 (scrollersOf)
- scenario: a sticky box inside an ancestor with `overflow: clip` (or `overflow-x: clip`), inside a real scroller. CSS skips a clip box when it looks for the scroll container a sticky box sticks to, but `styleOf(p)?.overflow !== 'visible'` matches `clip`. So the sticky scroller is built on the clip box, which never scrolls. On the stuck axis its "moved" stays at about 0. The real scroller further up is then pushed as a plain `scrollerOf`, which subtracts its whole scroll offset. Scroll that scroller during the drag while the box is stuck, and the reported point slides by the scroll distance although the box never moved.
- evidence: read
- severity: low
- size: line
- cause: scroll-container test counts `clip`
- confidence: likely

## A rect element that is itself sticky has its live rect read on every move, so the drag's own movement of the box leaks into the coordinates the press measured once
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:120 (stickyScrollerOf, via scrollersOf)
- scenario: `useHandleDrag` measures the box once at the press, because "by default the box is the handle's own, which the drag moves". When that element, the handle itself or a `getRect` target, is `position: sticky` with an inset, `scrollersOf` puts it first in the chain (`sticky ??= n` with `n === el`). Its `moved()` then reads `box.getBoundingClientRect()` on every move. A drag that moves the handle (by transform, or by changing a size before it in the flow) changes `b.left` and `b.top` with no scroll at all, and `localOf` reads that change as scroll. The reported point then chases the handle, which is the feedback the once-only measurement exists to prevent.
- evidence: read
- severity: low
- size: function
- cause: sticky offset read from the moving box's live rect
- confidence: likely

## A sweep never re-enters an element whose key changed under the pointer, because `reach` demands both a new element and a new key
- where: packages/routing/src/interactions/sweep/sweep.ts:132 (createSweepAction → reach)
- scenario: `reach` enters an item only when `item.element !== current.element && !Object.is(item.key, current.key)`. Take a grid that recycles its cell elements, or a surface re-rendered during the sweep (a wheel scroll mid-drag, or an `enter` whose effect re-keys the row) where the cell under the pointer now answers a different key from `keyOf`. The element is the same, so the new item is never entered and `current` keeps the stale key. `SweepRun.enter` promises a call "whenever the item under the pointer changes", and an item is its key. The condition should be `||` on the key (or the key alone).
- evidence: read
- severity: low
- size: line
- cause: `&&` where the item identity is the key
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

<!-- done: 4 findings, files read: 14 -->
