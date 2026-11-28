# routing.interactions — blind review

## `holdsFixed` reads `will-change: contents` as a containing block for fixed boxes
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:62 (holdsFixed)
- scenario: a handle's rect element is `position: fixed` inside an ancestor with `will-change: contents`. The regex `/transform|translate|rotate|scale|perspective|filter|contain/` matches the substring `contain` in `contents`, so `scrollersOf` stops at that ancestor as if it held the fixed box. It then walks on up, adding every ancestor's scroller and the page's. Scrolling the page mid-drag shifts the reported local point by the scroll distance, even though a fixed box does not move when the page scrolls. `will-change: contents` creates no containing block, so the walk should go up to the viewport and return no scrollers.
- evidence: read
- severity: low
- size: line
- cause: unanchored substring regex over a keyword list
- confidence: sure

## A sweep never reaches the item under the release point
- where: packages/routing/src/interactions/sweep/sweep.ts:146 (createSweepAction, onEnd)
- scenario: `onEnd(_end, how)` ignores the end ctx's `world`, so a release whose point differs from the last move is never travelled to. That happens with a pointerup that arrives without a pointermove at its coordinates first: a coalesced or synthesized final move, or a fast touch lift. The item under the release, and any items crossed between the last move and the release, never get `enter`. Committing should first `travel(end.world)` when the run ends by `'commit'`.
- evidence: read (invoker.ts:247 passes `onEnd(ctx, reason)` with the end ctx)
- severity: low
- size: line
- cause: end point dropped on the release path
- confidence: likely

## A sweep cannot reach items inside a shadow root within its surface
- where: packages/routing/src/interactions/sweep/sweep.ts:88 (itemAt)
- scenario: the surface is a light-DOM element, and its items are rendered inside an open shadow root of a component it contains. `elementAt(surface, …)` hit-tests in the surface's own tree, so it returns the shadow host, not the item. The walk then climbs by `parentElement`, which never enters or leaves a shadow root. `keyOf` is asked only of the host and its light-DOM ancestors, so no item is ever pressed: `enabled` answers NotApplicable and the press falls through. `carry.ts` and `pointerSession.ts` treat shadow content as inside its host (`containsComposed`), so the two pathways answer this question differently.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/sweep/sweep.ts, packages/routing/src/interactions/elementAt.ts
- size: function
- cause: hit-test and ancestor walk not composed across shadow roots
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
