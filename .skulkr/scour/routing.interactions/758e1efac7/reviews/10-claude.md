## A sticky box stuck to the page reads the page scroll backward, so handle coordinates drift by the scroll during a drag
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:126 (stickyScrollerOf)
- scenario: a slider handle (useHandleDrag) in a `position: sticky; top: 0` toolbar whose scroller is the page, so `scrollersOf` reaches `p === root` and builds `stickyScrollerOf(sticky, documentElement, …)`. `moved()` reads `p.top - b.top` with `p = documentElement.getBoundingClientRect()`. The document element's box moves with page scroll (its top is `-scrollY`), unlike a scroll container's border box, which stays put while its content scrolls. If the toolbar is stuck and the page scrolls by `d` mid-drag (wheel during the drag), `b.top` stays at 0 while `p.top` drops by `d`. `moved().y` changes by `-d`, `localOf` shifts the box down by `d`, and every reported point is off by `d` even though the handle never moved on screen. If the toolbar is still riding the scroll (not yet stuck), `p.top - b.top` stays constant, so the drift is 0 while the box really moved by `d`. It is wrong both ways. It should measure against the viewport (0, 0) when the scroller is the root, the same way it measures against a scroll container's fixed border box.
- evidence: read
- severity: medium
- size: line
- cause: document element's rect used as a fixed scrollport
- confidence: likely

## `will-change: contents` counts as making a box the containing block of fixed descendants
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:61 (holdsFixed)
- scenario: the `will-change` test is `/transform|translate|rotate|scale|perspective|filter|contain/`, and `contain` also matches the value `contents`, which does not create a containing block. Take a `position: fixed` rectEl (say, a fixed HUD with handles) with an ancestor marked `will-change: contents`. `scrollersOf` takes that ancestor as the fixed box's containing block and walks on up from it, adding the page's and other ancestors' scroll offsets. A scroll during the drag then shifts `localOf`'s box although the fixed element never moved. It should match `contain` as a whole word only, e.g. `/(^|,\s*)contain(\s*,|$)/` or a token split.
- evidence: read
- severity: low
- size: line
- cause: substring regex on a keyword list
- confidence: sure

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
