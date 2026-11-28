# text-dom findings

## Typing over a selection that starts at a run boundary takes the earlier run's style, while a paste over the same selection takes the first replaced character's
- where: packages/text-dom/src/overlayTyping.ts:120 (onBeforeInput)
- scenario: runs `[{text:'ab'}, {text:'cd', bold:true}]`, selection [2,4) (the bold "cd"), made by `selectOffsets` or a drag that anchors at the end of "ab"'s text node (`charOffsetToDomPosition(2)` returns `(text "ab", 2)`). Typing "x": `onBeforeInput` returns early for any non-collapsed caret, so the browser deletes the range and inserts into the text node holding the start, giving a plain "x" (the run before). Pasting "x" over the same selection goes through `styledForRange`, which reads `runStyleAt(runs, at.start + 1)`, the first replaced character, giving a bold "x". The same replacement gets two answers depending on whether it was typed or pasted (and, for typing, on which side of the boundary the DOM anchored the selection).
- evidence: read
- severity: medium
- fix: packages/text-dom/src/overlayTyping.ts
- size: function
- cause: non-collapsed insertText left to the browser, paste styled by its own rule
- confidence: likely

## `setStyle` and `applyStyleToSelection` docs omit that taking off a node-level script also needs `setStyle`/`onChange`
- where: packages/text-dom/src/textEditTypes.ts:175 (UseTextEditOptions.setStyle), packages/text-dom/src/textEditTypes.ts:285 (UseTextEditReturn.applyStyleToSelection)
- scenario: node style `{ script: 'super' }`, host passes neither `setStyle` nor `onChange`. Cmd+Shift+= over a range yields `{ script: undefined }`; `applyStyle`'s `unsetScript` branch requires `canWriteStyle`, so it falls through to `applyStyleToRange`, which changes no run, and the text stays superscript. The docs say `setStyle` is "needed only to turn underline, strikethrough or overline off", and `applyStyleToSelection` describes the node-rewrite path only for flags, so a host reading them has no reason to expect the script toggle to be declined (or that a commit will call `setStyle` for it).
- evidence: read
- severity: low
- fix: packages/text-dom/src/textEditTypes.ts
- size: line
- cause: doc not updated when `clearScriptOverRange` path was added
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
