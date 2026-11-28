## useHandleDrag's scroll compensation misses a `transform-style: preserve-3d` ancestor as the holder of a fixed box
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:59 (holdsFixed)
- scenario: the rect element is `position: fixed` inside a scrolling container whose child has `transform-style: preserve-3d` (which, per CSS Transforms 2, makes it the containing block of fixed descendants). `scrollersOf` climbs past that box to the viewport and returns no scrollers, so when the container scrolls mid-drag the fixed box moves on screen but `localOf` does not shift the measured box, and every reported point is off by the scroll distance. It should count `transform-style: preserve-3d` as a holder, as it does `perspective`.
- evidence: read
- severity: low
- size: line
- cause: incomplete containing-block property list
- confidence: likely

## openPointerSession's doc says `onEnd` fires before teardown completes, but teardown runs first
- where: packages/routing/src/interactions/pointerSession/pointerSession.ts:60 (PointerSessionCallbacks.onEnd), 140 (end)
- scenario: `end` calls `teardown()` and only then `cb.onEnd(e)`. Inside `onEnd`, the session already reads `active === false`, capture is already released and `heldWithin` no longer sees it. A caller that trusts the doc, for example by calling `session.capture()` or reading `active` in `onEnd`, gets a no-op or `false`. The doc should match the order, or the order should match the doc.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/pointerSession/pointerSession.ts
- size: line
- cause: doc contradicts call order
- confidence: sure

## A sweep surface that is a shadow host never reaches the items in its own shadow root
- where: packages/routing/src/interactions/sweep/sweep.ts:96 (itemAt)
- scenario: `surface()` returns a custom element whose items live in its own shadow root. `elementAt(surface, …)` hit-tests in the tree the surface belongs to (the document), which retargets every hit to the host. Then `el === surface` and the ancestor walk stops at once. `pressed` is `null`, so `enabled` answers NotApplicable and the press never sweeps. Hit-testing should look inside `surface.shadowRoot` when there is one.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/sweep/sweep.ts, packages/routing/src/interactions/elementAt.ts
- size: function
- cause: hit test in host's tree, not its shadow root
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
