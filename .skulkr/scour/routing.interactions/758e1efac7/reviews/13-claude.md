## A sticky rect stuck to the page (no overflow ancestor) reports coordinates off by the page scroll
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:96 (scrollersOf) and :112 (stickyScrollerOf)
- scenario: `useHandleDrag` on a handle whose rect element is `position: sticky; top: 0` with no scrolling ancestor, so `p === root` and `stickyScrollerOf(sticky, documentElement, …)` is pushed. `moved()` reads `p.top - b.top` with `p = documentElement.getBoundingClientRect()`, but the html element's border box moves on screen with the page scroll (its `top` is `-scrollY`), unlike an overflow scroller's box, which stays put while its content scrolls. Press at scrollY 500 while stuck (b.top 0): moved.y = -500. Scroll the page 100 more: the box stays stuck on screen (b.top 0), moved.y = -600, so `localOf` shifts the box down by 100 and every reported y is 100 too small, though the box never moved. Not yet stuck: the box rides the scroll (b.top and p.top both fall by Δ), moved.y stays the same, so the scroll is not counted at all. Both cases are wrong; the formula only holds for a scroller whose own rect stays put on screen. For the root it should measure against the viewport (top/left 0), i.e. use `-b.top`/`-b.left` in place of `p.top - b.top`. The sticky tests (handleDrag.test.ts:401–455) cover only an `overflow: auto` div scroller.
- evidence: read
- severity: medium
- fix: packages/routing/src/interactions/handleDrag/handleDrag.ts, packages/routing/src/interactions/handleDrag/handleDrag.test.ts
- size: line
- cause: documentElement rect taken as the viewport's scrollport
- confidence: likely

## A sweep surface that is a shadow host never reaches the items in its shadow tree
- where: packages/routing/src/interactions/sweep/sweep.ts:87 (itemAt)
- scenario: `createSweepAction({ surface: () => host, keyOf })` where `host` renders its toggles in its own shadow root. `elementAt(surface, …)` hit-tests in the tree the surface belongs to (the document), which retargets every hit inside the shadow root to `host` itself. The loop `for (; el && el !== surface; …)` then stops at once, `keyOf` is never asked, `enabled` answers NotApplicable, and no press on the surface sweeps. It should hit-test in `surface.shadowRoot` when the surface has one (e.g. `elementAt(surface.shadowRoot ?? surface, …)`) and climb with a flat-tree parent instead of `parentElement`, which also stops at a shadow root's top.
- evidence: read
- severity: low
- size: function
- cause: hit test in the surface's own tree, not its shadow tree
- confidence: likely

## PointerSessionCallbacks.onEnd says it fires before teardown, but the session tears down first
- where: packages/routing/src/interactions/pointerSession/pointerSession.ts:61 (PointerSessionCallbacks.onEnd doc), :152 (end)
- scenario: the doc says `onEnd` "Fires once, before teardown completes". `end()` calls `teardown()` (listeners removed, capture released, `active = false`, dropped from `OPEN`) and only then calls `cb.onEnd(e)`. A caller relying on the doc and reading `session.active`, `heldWithin`, or the origin's pointer capture inside `onEnd` sees the session already gone: `active` is false and `heldWithin` no longer counts it. Either the doc or the order is wrong; `abort` has the same order, which suggests the doc is the stale half.
- evidence: read
- severity: low
- size: line
- cause: stale doc comment
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

<!-- done: 3 findings, files read: 14 -->
