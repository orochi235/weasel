# routing.interactions — blind review findings

## A sweep surface inside a shadow root never reaches items slotted into it
- where: packages/routing/src/interactions/sweep/sweep.ts:96 (itemAt)
- scenario: the surface element lives in a component's shadow root and its items are light-DOM children assigned to a `<slot>` inside it. `elementAt(surface, …)` hit-tests in the shadow root, and retargeting leaves a document-tree node as it is, so it returns the slotted light element. `surface.contains(el)` is false for a slotted node, and walking up `parentElement` never meets the surface either, so `itemAt` returns `null`: `enabled` reports NotApplicable and the sweep never opens. It should treat the flat tree as containment (`containsComposed` / an `assignedSlot` walk, as `handleDrag`'s `flatParentOf` already does).
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/sweep/sweep.ts, packages/routing/src/interactions/elementAt.ts
- size: function
- cause: light-tree `contains`/`parentElement` used where layout is the flat tree
- confidence: likely

## A carry surface inside a shadow root is skipped over its own slotted content
- where: packages/routing/src/interactions/carry/carry.ts:89 (surfaceAt)
- scenario: a dispatcher with a `carry` channel mounts on an element inside a shadow root, and what fills it is light-DOM content slotted in. The hit from `elementAt` is that slotted light element; `s.element.contains(hit)` is false, so the surface is treated as covered by something else and skipped. A carry over it gets no `enter`/`move`, and a release there drops nowhere (`taken: false`). Containment should follow slot assignment, as for the sweep above.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/carry/carry.ts, packages/routing/src/interactions/elementAt.ts
- size: function
- cause: light-tree `contains` used where layout is the flat tree
- confidence: likely

## A sweep misses an item whose element is reused under a new key
- where: packages/routing/src/interactions/sweep/sweep.ts:132 (createSweepAction → reach)
- scenario: `reach` enters a new item only when its element differs from the current one **and** its key differs. In a surface that recycles elements (a virtualized grid scrolled mid-sweep, or a row re-keyed after `enter` changes data), the element under the pointer stays the same while `keyOf` now names a different item, so that item is never entered. The doc says `enter` fires "whenever the item under the pointer changes". The key should decide, with the element only breaking ties for keys `keyOf` builds fresh each call.
- evidence: read
- severity: low
- size: line
- cause: `&&` where key change alone means a new item
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
