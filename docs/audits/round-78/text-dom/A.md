# Audit round 78, text-dom, blind reviewer

## A Windows AltGr chord that types a non-Latin capital is taken as a styling shortcut, so Shift+AltGr+X cannot type Ź on a Polish layout
- where: packages/text-dom/src/styleShortcuts.ts:35 (toggleForKey)
- scenario: Windows reports AltGr as `ctrlKey && altKey`. On the Polish (programmer) layout Shift+AltGr+X types `Ź`: `{ key: 'Ź', code: 'KeyX', ctrlKey: true, altKey: true, shiftKey: true }`. `toggleForKey` checks neither `altKey` nor whether the chord typed a character; `matchKeyEvent` falls back to `chordKey`, which reads a non-ASCII one-character key as its physical key (`'X'`), so the strikethrough row matches, `onKeyDown` calls `preventDefault()` and toggles strikethrough instead of letting the letter be typed. The same holds for any AltGr letter on B, I or U on other layouts that types a non-ASCII character. A chord carrying Alt (AltGr) should not be read as Cmd/Ctrl+letter.
- evidence: read (packages/gestures/src/ui/keyLetter.ts:30-37 chordKey, match.ts:100 matchKeyEvent)
- severity: medium

## normalizeSmallCaps flattens any element nested in a small-caps run span, dropping the styling it carried
- where: packages/text-dom/src/domRuns.ts:309 (normalizeSmallCaps, via piecesMatch at domRuns.ts:269 and writeSmallCaps)
- scenario: a small-caps run span gets a nested styled element from the browser's own editing, e.g. a native `formatBold`/`formatItalic` from Safari's Format menu or context menu (the hook intercepts only the keyboard shortcuts, not that `beforeinput`), which wraps the selection in `<b>`/`<i>`. `domToRuns` reads that `<b>` as bold (runStyle.ts:155), but the same `input` runs `resplitSmallCaps` → `piecesMatch` returns `false` for any child that is not text, `<br>`, a break or a piece, so `writeSmallCaps` replaces the span's children with flat text and pieces. The bold just applied disappears from the DOM, the draft and the commit. Outside small caps the same span is left alone, so the two cases answer differently.
- evidence: read
- severity: low

## Typing joins the previous undo step after the caret has left and come back, though the history says a step joins only while the caret has not left
- where: packages/text-dom/src/overlayHistory.ts:96 (overlayHistory `after`, `caretAt`)
- scenario: type "ab" at the end of "x|y" (caret at 3), press Left then Right (or click elsewhere and click back at offset 3), type "c". Nothing calls `seal()` on a caret move (only composition start does), and `after` joins a `type` change whenever its starting caret equals the caret the last step left, so "c" lands in the same step as "ab". One Undo takes out "abc", not "c". The doc comment says typing joins "a run of their own kind that the caret has not left"; a move away and back is a leave the check cannot see. A `selectionchange` that moves the caret off `open.caret` should seal.
- evidence: read
- severity: low

## While an open edit waits with no container, `nodeStyle` and `effectiveStyle` report the node's own style, not the rewritten one the edit still holds
- where: packages/text-dom/src/useTextEdit.ts:143 (effect cleanup `holdNodeStyle(null)`), with overlayCarry.ts:50 (stashCarry) and useTextEdit.ts:53 (commit reading `carried.held`)
- scenario: edit a node whose style sets underline, take underline off a range (the node style is rewritten and held), then the host sets `container` to `null` (a remount, a panel swap). The cleanup stashes `held` in the carry and then calls `holdNodeStyle(null)`; the next effect run returns early with no container, so `nodeStyle` is `null` and `effectiveStyle` (via `shownStyle`) is built from `getStyle(id)`, still underlined. The edit is still open (`editingId` is set) and a commit in that state writes `carried.held`, so a control showing the node's style during the gap shows the opposite of what will be written. `UseTextEditReturn.nodeStyle` is documented as the rewritten style "not yet written back".
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
