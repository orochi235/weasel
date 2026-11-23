# Audit round 75 — text-dom — findings

## A table cell whose text sits in a block loses its tab and lands on a line of its own
- where: packages/text-dom/src/pasteRuns.ts:142 (htmlToRuns, `visit` / `boundary`)
- scenario: paste `<table><tr><td><p>a</p></td><td><p>b</p></td></tr></table>`, the markup Google Docs (and many editors) put on the clipboard for a table. The second `<td>` adds `gap.tabs += 1`, but its `<p>` then calls `boundary()`, which sets `gap = { line: gap.line || onLine, tabs: 0 }`: the tab is thrown away and `line` is raised because the first cell left `onLine` true. The paste reads `"a\nb"` where the module's own contract ("a table cell follows the one before it after a tab") gives `"a\tb"`. Every cell of such a table goes on its own line, and its columns are lost.
- evidence: read
- severity: medium

## A window blur commits and closes the edit
- where: packages/text-dom/src/overlayListeners.ts:48 (listenToOverlay, `onBlur`)
- scenario: while editing, switch to another app or browser tab (Cmd+Tab, Ctrl+Tab). The focused overlay gets `blur` with `relatedTarget === null`; `isChrome(null)` is false, so `commit()` runs and the edit ends. On return the user's caret, selection, armed style and undo history are gone, and the node is no longer in edit mode. A blur caused by the window itself losing focus (`!document.hasFocus()`) should not end the edit — the element regains focus when the window does.
- evidence: read
- severity: medium

## Moving an open edit to another container drops its undo history and its armed style
- where: packages/text-dom/src/useTextEdit.ts:121 (effect: `createOverlayEdits` on the carried overlay; cleanup `clearSelection()` at 156); packages/text-dom/src/overlayCarry.ts:40 (stashCarry)
- scenario: type "abc" in an edit, then the host moves `container` (the carry path exists for exactly this). The cleanup calls `clearSelection()`, which runs `dropPending()`, and the new effect builds a fresh `overlayHistory` via `createOverlayEdits`. `CarriedEdit` carries content, draft, selection and held style but not the history or the pending patch, so Cmd+Z after the move does nothing (the keydown is preventDefault-ed into an empty stack) and a Cmd+B armed at the caret before the move no longer applies to the next character.
- evidence: read
- severity: low

## Undo back to the opened state of a text ending in a break still writes a commit
- where: packages/text-dom/src/overlaySeed.ts:61 (`wrote`); packages/text-dom/src/overlayDraft.ts:85 (`finished`)
- scenario: open an edit on plain text `"ab\n"`, select all, Cmd+B, Cmd+Z, Enter. The undo's `write` calls `holder.reseed` (ownBreak = true) and then `written` → `holder.wrote(overlay, 3)`: the caret is at the end of text ending in a break, so it sets ownBreak false and appends a second `\n` holder. `finished` compares the *untrimmed* read (`"ab\n\n"`) to `opened` (`"ab\n"`), finds them different, and writes `setText("ab\n")` / `onChange` — a write and a host undo step for an edit that left the node as found, contrary to `commitEdit`'s doc ("writes nothing").
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

<!-- done: 4 findings, files read: 36 -->
