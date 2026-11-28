# routing.interactions findings

## browserReservedChord misses a shifted chord named by `code`: Cmd+Shift+[ / ] on macOS
- where: packages/routing/src/interactions/browserReservedKeys.ts:80 (keysOf)
- scenario: `{ kind: 'key', key: '{', code: 'BracketLeft', mods: { mod: true, shift: true } }` on Apple. `code` matches "whatever a held modifier makes it type" (KeySpec docs), so this fires on Cmd+Shift+[, which Safari/Chrome take as "previous tab" (listed as key `{` with mod+shift). `keysOf` maps `bracketleft` only to its unshifted `[`, and the `[`/`]` entries forbid shift, so no chord matches and the function returns `null`. The same goes for `key: 'x', code: 'BracketRight'`, and for any shifted-character entry reached through `code` (`Digit3` + shift is covered only because `3` happens to be listed too). It should return the "previous and next tab on macOS" chord.
- evidence: read
- severity: low
- size: function
- cause: code→key map ignores shift's character
- confidence: sure

## The scroll correction for a sticky box treats an `overflow: clip` ancestor as the scroller it sticks in
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:97 (scrollersOf)
- scenario: the rect element is `position: sticky; top: 0` inside a wrapper with `overflow: clip`, inside a scrolling pane. `overflow: clip` does not create a scroll container, so the box sticks in the pane. But `styleOf(p).overflow !== 'visible'` is true for `clip`, so the clip wrapper becomes the sticky scroller (its offset from the box never changes) and the pane is then added as a plain `scrollerOf`. Scroll the pane mid-drag while the box is stuck: the box stays put on screen, yet `localOf` shifts the measured box by the pane's whole scroll delta, so `onMove` reports points off by that amount. Only `auto`/`scroll`/`hidden` (and the root) should count as the scroller.
- evidence: read
- severity: low
- size: line
- cause: overflow test treats clip as a scroller
- confidence: likely

## A carry over a surface's slotted light-DOM children doesn't find the surface
- where: packages/routing/src/interactions/carry/carry.ts:85 (surfaceAt)
- scenario: the surface element lives inside a shadow root and shows light-DOM content through a `<slot>`. `elementAt` hit-tests in the surface's shadow root. The element under the pointer is the slotted light-DOM child, which sits outside that shadow tree, so `s.element.contains(hit)` is false and the surface is skipped. Enter, move and drop never reach it, even though the pointer is visibly over it. The containment test should go through the flat tree (assigned slots), not `Node.contains`.
- evidence: read
- severity: low
- size: function
- cause: Node.contains ignores slot assignment
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
