## A hidden edit overlay of a clipping node leaves its scroll box catching pointer input, so presses there neither reach the canvas nor end the edit
- where: packages/text-dom/src/overlayPlace.ts:68 (placeOverlay)
- scenario: Edit a node whose pose has `clip`. `placeScrolled` sets the scroll box (`boxes.scroll`) to `pointerEvents: 'auto'` with the node's width, height, and position. Mid-edit, `getScreenPose` returns `null` (useSceneTextEdit does this when the node is removed, e.g. by a remote change or an undo elsewhere). `placeOverlay` then only sets the overlay to `display: none` and returns, so the scroll box keeps its size and `pointer-events: auto`. That is an invisible, hit-testable rectangle over the canvas. A press inside it lands on the box, `onPointerDownOutside` sees `scroll.contains(target)` and does not commit, and the canvas never gets the press. The user clicks on empty-looking canvas and nothing happens until they click somewhere else. Expected: a hidden overlay's boxes pass input through (`pointerEvents: 'none'`, as `placeLoose` resets them), or get hidden with it.
- evidence: read
- severity: medium

## normalizeSmallCaps drops a `<br>` inside a small-caps run span, deleting the line break the user typed
- where: packages/text-dom/src/domRuns.ts:255 (sourceText), used at domRuns.ts:303–310 (normalizeSmallCaps)
- scenario: `domToRuns` and `overlayPieces` read a `<br>` as `\n`. `sourceText` skips it, because `sourceText(br)` is `''`. Take a node in small caps whose face has none of its own, so its run spans hold `data-small-caps` pieces. In a browser that answers Shift+Enter with a `<br>` (Firefox does in a contenteditable), the `<br>` lands inside the run span. On the `input` that follows, `resplitSmallCaps` runs `normalizeSmallCaps`. `piecesMatch` returns false for the BR child, so `writeSmallCaps(el, sourceText(el), …)` rewrites the span from text that has no newline, and the `<br>` is gone. The same happens in the `else if (el.querySelector('[data-small-caps]'))` branch. The caret offsets restored afterwards are counted with the newline, so the caret also lands one character off. Expected: `sourceText` counts a `<br>` (and a block boundary) the way `domToRuns` does.
- evidence: read
- severity: medium

## The overlay is placed with the style the edit opened with, not the node style the edit has since rewritten
- where: packages/text-dom/src/editOverlay.ts:59 (openEditOverlay `place`)
- scenario: `place` always passes `node.style`, captured at open, to `placeOverlay`. `typeset` and `baselineDrop` read `fontStyle`, `fontWeight`, `script` and `fontFamily` from it. When a toggle lowers a flag the node sets (e.g. Cmd+I inside an `italic: true` node, the `setFlagOverRange` path), `restyleNode` puts the new resolved style on the overlay (`applyOverlayStyle`) and in `baseRef`. `place` keeps measuring the canvas baseline with the old face. `cssBaseline` measures the overlay's new face from `el.style`, so `baselineDrop` subtracts one face's baseline from another's. After an un-italic, the overlay is offset vertically by the difference in ascent between the italic and roman faces until the edit ends. An undo that restyles back has the same problem in reverse. Expected: `place` reads the style the edit currently holds (`baseRef`-equivalent).
- evidence: read
- severity: low

## A negative `startEdit` caret throws from the edit-opening effect
- where: packages/text-dom/src/overlayOpen.ts:34 (openingRange), packages/text-dom/src/domOffsets.ts:66 (charOffsetToDomPosition)
- scenario: Call `startEdit(id, { caret: -1 })`, e.g. with a hit test that returns -1 for a miss. `charOffsetToDomPosition` returns `{ node: firstText, offset: -1 }`, because `remaining <= len` holds for a negative number. `range.setStart(text, -1)` converts -1 to 4294967295 and throws `IndexSizeError` inside the `useEffect`. The overlay has already been mounted at that point and is never removed, since the effect never returned its cleanup. The doc says the caret is clamped. Only the high end is clamped. Expected: clamp to `[0, length]`.
- evidence: read
- severity: low

## Restoring focus after a chrome styling scrolls a clipping node's box back to its start
- where: packages/text-dom/src/overlaySelection.ts:76 (restoreOverlayFocus)
- scenario: Edit a clipped (`pose.clip`) node, scroll its text down, select a word, then click a styling button in the editor chrome that takes focus. `applyStyle` calls `restoreOverlayFocus`, which runs a bare `overlay.focus()`. `OverlayScroll.focus` exists because doing that scrolls the box to the start, and because the scroll is armed, `onScroll` records the jump as the user's own offset. The text jumps to the top, and `reveal` then pulls the caret back only to the box's edge, not to where it was. `overlay.focus()` with no `preventScroll` can also scroll the page's ancestors. Expected: focus without scrolling (`scroller.focus()` or `focus({ preventScroll: true })`).
- evidence: read
- severity: low

## The test harnesses answer `getScreenPose` through `in` on a user-keyed table
- where: packages/text-dom/src/testing/textEditHarness.ts:16 and :48 (makeHarness, makeRichHarness)
- scenario: `id in texts` / `id in data` is true for `'toString'`, `'constructor'` and `'__proto__'`. `startEdit('constructor')` then gets a pose, and `getText` returns `texts['constructor'] ?? ''`, which is the `Object` function, so the overlay is seeded with a function's text. A test using an id like that sees an edit open on a node that does not exist. This is the `in`-to-`Object.hasOwn` sweep (39bc95f3e0) that missed these two lines.
- evidence: read
- severity: low

## Files read
packages/text-dom/src/armedStyle.ts
packages/text-dom/src/domOffsets.ts
packages/text-dom/src/domRuns.ts
packages/text-dom/src/editOverlay.ts
packages/text-dom/src/editSession.ts
packages/text-dom/src/heldNodeStyle.ts
packages/text-dom/src/index.ts
packages/text-dom/src/overlayBaseline.ts
packages/text-dom/src/overlayDirection.ts
packages/text-dom/src/overlayDraft.ts
packages/text-dom/src/overlayEdits.ts
packages/text-dom/src/overlayFollow.ts
packages/text-dom/src/overlayFrame.ts
packages/text-dom/src/overlayHistory.ts
packages/text-dom/src/overlayListeners.ts
packages/text-dom/src/overlayOpen.ts
packages/text-dom/src/overlayPlace.ts
packages/text-dom/src/overlayScroll.ts
packages/text-dom/src/overlaySeed.ts
packages/text-dom/src/overlaySelection.ts
packages/text-dom/src/overlayStyle.ts
packages/text-dom/src/overlayTyping.ts
packages/text-dom/src/pasteRuns.ts
packages/text-dom/src/pbt.fixture.ts
packages/text-dom/src/publishedRange.ts
packages/text-dom/src/runSplice.ts
packages/text-dom/src/runStyle.ts
packages/text-dom/src/selectionStyling.ts
packages/text-dom/src/styleShortcuts.ts
packages/text-dom/src/testing/baselineDrop.ts
packages/text-dom/src/testing/overlayDirection.ts
packages/text-dom/src/testing/overlayReady.ts
packages/text-dom/src/testing/textEditHarness.ts
packages/text-dom/src/textEditTypes.ts
packages/text-dom/src/useTextEdit.ts

<!-- done: 6 findings, files read: 35 -->
