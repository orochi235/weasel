## containsComposed ignores slot assignment, so heldWithin misses an item drag on slotted content
- where: packages/routing/src/interactions/elementAt.ts:22 (containsComposed)
- scenario: a surface element lives inside a web component's shadow root and renders its items through a `<slot>`; an item (a light-DOM child of the host, slotted into the surface) opens its own pointer session. `heldWithin(pointerId, surface)` calls `containsComposed(surface, origin)`: `surface.contains(origin)` is false, and the walk goes from the origin's root (the document) to `host` = null, so it answers false. The surface's sweep/drag does not yield and both the item's drag and the surface's run on one press. The slotted item sits inside the surface in the flat tree, which is where its box is laid out and hit; it should count as inside.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/elementAt.ts
- size: function
- cause: walks shadow hosts but not assignedSlot
- confidence: likely

## A carry over slotted content inside a shadow-root surface never lands on that surface
- where: packages/routing/src/interactions/carry/carry.ts:86 (surfaceAt)
- scenario: a carry surface is an element inside a shadow root with a `<slot>`; the pointer is over a slotted light-DOM child. `elementAt(s.element, …)` hit-tests in the shadow root and gets the light-DOM child (in an ancestor tree, so not retargeted). `s.element.contains(hit)` is false, so the surface is skipped as "covered" and the carry gets no enter/move/drop there, though nothing covers it. The same slot-blind test is in sweep's `itemAt` (`!surface.contains(el)` and the `parentElement` walk), so a sweep over slotted items in such a surface reaches none of them.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/carry/carry.ts, packages/routing/src/interactions/sweep/sweep.ts, packages/routing/src/interactions/elementAt.ts
- size: function
- cause: light-tree contains used where flat-tree containment is meant
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

<!-- done: 2 findings, files read: 14 -->
