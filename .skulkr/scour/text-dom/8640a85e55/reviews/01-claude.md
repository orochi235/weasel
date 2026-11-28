# text-dom findings

## A lone CR left by an edit stays raw text in the overlay, so the overlay stops breaking where the canvas breaks
- where: packages/text-dom/src/domRuns.ts:357 (normalizeSmallCaps / normalizeText)
- scenario: a node seeded with `"a\r\nb"`. `appendOverlayText` leaves the CR as raw text because an LF follows it (`domRuns.ts:57`), and the module's own comment says the CR then draws nothing. If the user puts the caret at the start of `b` and presses Backspace (deleting the LF), or types a character between the CR and the LF, the DOM holds `"a\rb"` or `"a\rX\nb"`. Each keystroke then runs `resplitSmallCaps` → `normalizeSmallCaps`, which rewrites a stretch only when `piecesMatch` fails. Raw CR text matches its pieces, so the CR never becomes a `<span data-break>`. The canvas treats the lone CR as a hard break (`isHardLineBreak(13)`) and shows two lines; the overlay draws nothing there and shows one, and the caret walks a different layout than the text it stands for. It stays that way until some restyle or paste happens to rewrite the runs. It should be turned into a break stand-in once it is no longer followed by an LF.
- evidence: read
- severity: low
- fix: packages/text-dom/src/domRuns.ts
- size: function
- cause: stand-ins only written on full rewrites, never re-derived after browser edits
- confidence: likely

## `setStyle` docs say it is needed only for underline/strikethrough/overline, but taking off a node-level script needs it too
- where: packages/text-dom/src/textEditTypes.ts:160 (UseTextEditOptions.setStyle doc)
- scenario: a node whose `TextStyle` has `script: 'super'`, edited without `setStyle` or `onChange`. Cmd+Shift+= over a range produces `{ script: undefined }`. `applyStyle` takes the `unsetScript` rewrite only when `canWriteStyle` is true (`selectionStyling.ts:93`). Without it, the patch goes to `applyStyleToRange`, which changes nothing because the runs have no script, so the toggle is silently declined. The doc ("needed only to turn underline, strikethrough or overline **off**") tells a host it can leave `setStyle` out if it never lowers those three flags, and `applyStyleToSelection`'s doc (`textEditTypes.ts:285`) also names only flags. Both should name a node-level `script`.
- evidence: read
- severity: low
- fix: packages/text-dom/src/textEditTypes.ts
- size: line
- cause: doc not updated when clearScriptOverRange path was added
- confidence: sure

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
