# Audit round 77 — text-dom (blind reviewer)

## Lowering italic in an italic node takes the node-rewrite path, holding and committing a node style that never changed
- where: packages/text-dom/src/selectionStyling.ts:85 (useSelectionStyling → applyStyle, `unsetFlag`)
- scenario: a host with `setStyle` or `onChange` edits a node whose `TextStyle` has `fontStyle: 'italic'`; the user selects a word and presses Cmd+I. `patchForToggle` returns `{ italic: false }`; `unsetFlag` excludes only `'bold'`, so `italic` is found (`styleHasFlag(style, 'italic')` is true) and the rewrite branch runs. `setFlagOverRange` handles italic by writing `italic: false` over the range and returns the node style unchanged, yet `restyleNode(overlay, id, r.style)` holds that copy as the rewritten node style: `nodeStyle` reports a rewrite that did not happen, `seedDraft().finished` can no longer return `null` (its no-change check needs `!style`), and commit calls `setStyle`/passes `style` to `onChange` with the node's own style. Without `setStyle`/`onChange` the same keystroke takes the plain range path instead, so one action is answered two ways depending on the host. `UseTextEditReturn.applyStyleToSelection`'s docs say bold and italic are spared the rewrite; the code spares only bold. Should exclude `'italic'` alongside `'bold'` (as `setFlagOverRange` itself does).
- evidence: read (selectionStyling.ts:83-110; packages/text/src/runs/flagRange.ts:83-90; textEditTypes.ts `applyStyleToSelection` doc)
- severity: medium

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

<!-- done: 1 findings, files read: 36 -->
