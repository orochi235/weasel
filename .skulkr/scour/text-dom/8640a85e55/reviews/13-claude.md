# text-dom findings

## An edit ended and reopened on the same node in one batch, while the container is null, reopens on the ended edit's carried content
- where: packages/text-dom/src/overlayCarry.ts:39 (takeCarry), packages/text-dom/src/useTextEdit.ts:58 (commit), :55 (cancelEdit)
- scenario: An edit on `a` is open and the host sets `container` to null, so the cleanup stashes a carry for `a` (overlayCarry.ts:47). In one event handler the host calls `cancelEdit()` and then `startEdit('a')`. React batches both into one render where `editingId` is still `'a'` and only `session` has changed. The effect then runs `takeCarry('a', false)`, which keeps the stale carry because its id matches. When the container comes back, the "new" edit opens on the canceled edit's DOM, draft, history and armed style, so a canceled edit comes back to life. `commit()` in that window also writes the carry through `peekCarry`. Calling `commitEdit()` then `startEdit('a')` has the same problem: the reopened edit starts from the already-written carry, with that carry's draft baseline. What should happen: ending an edit drops its carry, so a reopened edit seeds fresh from `getText`/`getRuns`.
- evidence: read
- severity: low
- fix: packages/text-dom/src/overlayCarry.ts, packages/text-dom/src/useTextEdit.ts
- size: function
- cause: carry keyed by id only, not by session; not cleared on commit/cancel
- confidence: likely

## A line feed typed before a break stand-in's own `\n` is read back in the wrong order
- where: packages/text-dom/src/domRuns.ts:41 (restoreBreak)
- scenario: Take a node whose text holds U+2028. It is seeded as `<span data-break="2028">\n</span>`. If the caret sits at offset 0 inside that span's text node and the user presses Shift+Enter, the browser inserts `\n` before the stand-in, so the span's text becomes `"\n\n"`. `restoreBreak` replaces the first `\n` it finds (`indexOf`), so it reads back `" \n"` when the source order was `"\n "`. The same happens for any text typed before the stand-in that itself contains a `\n`. The committed text then has its two breaks swapped. What should happen: the stand-in is the character the span was seeded with, whatever is typed on either side of it.
- evidence: read
- severity: low
- fix: packages/text-dom/src/domRuns.ts (track the stand-in as its own text node or mark, rather than the first `\n` of the span's textContent)
- size: function
- cause: stand-in located by first `\n` in textContent
- confidence: likely

## Files read
packages/text-dom/src/armedStyle.ts
packages/text-dom/src/domOffsets.ts
packages/text-dom/src/domRuns.ts
packages/text-dom/src/editOverlay.ts
packages/text-dom/src/editSession.ts
packages/text-dom/src/heldNodeStyle.ts
packages/text-dom/src/index.ts
packages/text-dom/src/overlayBaseline.ts
packages/text-dom/src/overlayCarry.ts
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

<!-- done: 2 findings, files read: 36 -->
