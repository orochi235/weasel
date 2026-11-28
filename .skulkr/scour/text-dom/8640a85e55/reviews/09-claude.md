# text-dom findings

## A node's own trailing break is dropped once any browser edit leaves the text not ending in a break, even if a later edit restores it
- where: packages/text-dom/src/overlaySeed.ts:62 (seedOverlay → `edited`)
- scenario: a node seeded with text `"a\n"` (ownBreak true: the trailing newline is the node's, not a caret holder). The user puts the caret at the end, types `x` (browser insert → `edited` sees `"a\nx"`, sets `ownBreak = false`), then presses Backspace (browser delete). The DOM is back to `"a\n"` with no holder added (the same state Chromium seeds with no holder), but `ownBreak` stays `false`, so `trim` strips the node's own `\n`. `finished()` compares `"a"` with the opened `"a\n"`, finds a change and commits `"a"`: an edit that changed nothing deletes the node's final line break. `edited` can only ever clear `ownBreak`; nothing on the browser-edit path sets it again (only `reseed`, which runs on history writes).
- evidence: read
- severity: medium
- fix: packages/text-dom/src/overlaySeed.ts
- size: function
- cause: one-way ownBreak flag on browser edits
- confidence: likely

## Node-level small caps text that the browser types outside a run span is never split into pieces
- where: packages/text-dom/src/domRuns.ts:355 (normalizeSmallCaps → `visit`, non-run branch)
- scenario: a node with `fontVariantCaps: 'small-caps'` in a face with no small caps of its own. The user selects all and types. The browser replaces the selection itself (`overlayTyping` leaves a non-collapsed selection to the browser), which can leave a bare text node in the overlay root with no `data-run` span. `normalizeSmallCaps` only rewrites children of run spans. For text directly in the root it only adds the text to `before`, so those letters are drawn by the browser's own `font-variant: small-caps` synthesis on the root (`applyOverlayStyle`). The browser uses its fixed factor, not `smallCapsScaleFor`. That is the mismatch with the canvas that the module header says the pieces exist to prevent, and it lasts until the next full `runsToDom`.
- evidence: read
- severity: low
- size: function
- cause: normalization skips text outside run spans
- confidence: likely

## Rewriting the runs puts back a backward selection as a forward one
- where: packages/text-dom/src/overlaySelection.ts:31 (selectOffsets), used by writeRunsPreservingSelection and restoreOverlayFocus
- scenario: the user drags right to left over `"hello"` (anchor at 5, focus at 0) and presses Cmd+B. `readSelectionOffsets` normalizes to `{start: 0, end: 5}`, and `selectOffsets` restores it with `setStart`/`setEnd`, which puts the anchor at 0 and the focus at 5. Shift+Left then shrinks the selection from its right end, where the user expects it to grow from the left. The same happens after every restyle, paste, armed-character write and history step that restores a range.
- evidence: read
- severity: low
- fix: packages/text-dom/src/overlaySelection.ts, packages/text-dom/src/selectionStyling.ts
- size: function
- cause: selection direction discarded on read and restore
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

<!-- done: 3 findings, files read: 36 -->
