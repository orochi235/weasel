## `onEnd` is documented to fire before teardown completes, but fires after it
- where: packages/routing/src/interactions/pointerSession/pointerSession.ts:62 (PointerSessionCallbacks.onEnd), :152 (end)
- scenario: a caller reads `session.active`, relies on capture still being held, or calls `heldWithin` from inside `onEnd`, as the doc ("Fires once, before teardown completes") promises → `end` runs `teardown()` first, so `active` is already false, capture is released and the session is out of `OPEN`. The doc should say "after teardown", or the order should match it.
- evidence: read
- severity: low
- size: line
- cause: doc contradicts the call order
- confidence: sure

## The sticky scroller search takes an `overflow: clip` ancestor as the box's scroll container
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:98 (scrollersOf)
- scenario: a sticky handle's rect element sits inside an `overflow: clip` wrapper that is inside a real scroller → `styleOf(p)?.overflow !== 'visible'` is true for `clip`, so the wrapper is taken as the sticky scroller. `clip` makes no scroll container, so the box actually sticks in the outer scroller. The code then reads stuck/unstuck movement against the wrong rect and counts the outer scroller as plain scroll, so `onMove` coordinates drift by the scroll distance once the box sticks. The test should skip `clip` (and `visible`).
- evidence: read
- severity: low
- size: line
- cause: `clip` treated as a scrollport
- confidence: likely

## Carry surfaces from other documents (iframes) are hit-tested with the top document's client point
- where: packages/routing/src/interactions/carry/carry.ts:82 (surfaceAt)
- scenario: one module instance serves a page and a same-origin iframe, and each registers a carry surface → while a carry moves in the parent, `surfaceAt` compares the parent's clientX/Y with the iframe surface's `getBoundingClientRect()`, which is in iframe coordinates, then hit-tests the iframe's document at that point. The iframe surface can receive `enter`/`move`/`drop` for a pointer that is somewhere else entirely. The fix is to skip surfaces whose `ownerDocument` is not the origin's.
- evidence: read
- severity: low
- size: line
- cause: global surface set not scoped by document
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
