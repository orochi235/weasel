# Findings: routing.interactions

## useHandleDrag reads an `overflow: clip` ancestor as the scroller a sticky box sticks in
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:94 (scrollersOf)
- scenario: the rect element is (or sits inside) a `position: sticky; top: 0` box whose parent has `overflow: clip`, inside a real `overflow: auto` scroller. `overflow: clip` makes no scroll container, so the box sticks in the outer scroller. `scrollersOf` tests `overflow !== 'visible'`, so the clip box becomes the sticky's scroller. When the outer scroller scrolls while the box is stuck, `p.top - b.top` changes by the scroll amount, and the outer scroller is then also pushed as a plain scroller, so the scroll is counted twice. `onMove` reports points shifted by about twice the scroll, even though the box did not move on screen. It should skip `clip` (on either axis) when it looks for the sticky box's scrollport.
- evidence: read
- severity: low
- size: line
- cause: `clip` treated as a scroll container
- confidence: likely

## useHandleDrag ignores page scroll in quirks mode
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:88 (scrollersOf / scrollerOf)
- scenario: a page in quirks mode (no doctype) scrolls through `document.body`, which is `document.scrollingElement`, and `documentElement.scrollTop` stays 0. The chain ends at `root = documentElement`, so when the page scrolls during a drag, `scrollOf` reads 0 and the handle's local coordinates drift by the scroll distance. The root-held cases at lines 88 and 95 should read `ownerDocument.scrollingElement ?? documentElement`.
- evidence: read
- severity: low
- size: line
- cause: reads documentElement instead of scrollingElement
- confidence: likely

## browserReservedChord leaves out system chords a page can never receive
- where: packages/routing/src/interactions/browserReservedKeys.ts:33 (BROWSER_RESERVED_CHORDS)
- scenario: the header says the list is the union across browsers and desktops and "errs toward listing a chord". But `browserReservedChord({kind:'key', key:' ', mods:{alt:true}}, false)` returns null, and Alt+Space opens the window menu on Windows and many Linux desktops. On a Mac, `{key:' ', mods:{ctrl:true}}` returns null (Ctrl+Space switches the input source), so does `{key:' ', mods:{mod:true, ctrl:true}}` (the emoji and symbols viewer), and so does `{key:'q', mods:{mod:true, shift:true}}` (Log Out). Off a Mac, Ctrl+Shift+Q (quit in Chrome on Linux and Windows) also returns null. A kit default bound to any of these passes the reserved-key check and never fires.
- evidence: read
- severity: low
- size: line
- cause: incomplete chord table
- confidence: likely

## A sweep hit-tests the press point without the finite-number guard its moves have
- where: packages/routing/src/interactions/sweep/sweep.ts:121 (createSweepAction → pressed / itemAt)
- scenario: unruled.md (2026-11-11) rules that a sweep skips a point that is not a finite number, and `travel` does that for moves. `enabled(deps, at)` and `start` pass the press point straight to `itemAt` → `elementFromPoint`, though. A press whose point is `NaN` (a synthesized event with no client coordinates, or a dispatcher mapping that divides by 0) makes `elementFromPoint` throw a TypeError, because its arguments are non-unrestricted doubles. The press point should get the same guard and answer `NotApplicable`. Two paths answer the same question two ways.
- evidence: read
- severity: low
- size: line
- cause: guard applied to moves only
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
