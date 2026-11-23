## A character typed at the start of a run's text node takes that run's style, while the published caret style says the run to its left
- where: packages/text-dom/src/overlayTyping.ts:117 (typingHandlers.onBeforeInput)
- scenario: runs `[{text:'ab', bold:true}, {text:'cd'}]`; the DOM caret sits at (text node "cd", 0) — a click or arrow key at the boundary can put it there. `rangeStyle` (`styleAtCaret` → `runStyleAt(runs, 2)`) reports bold, so a toolbar shows bold and the user expects the next letter bold. `onBeforeInput` returns early because `caret.startContainer` is a text node, so the browser inserts into "cd" and the letter comes out plain. The guard only reroutes carets at element positions; a caret at offset 0 of any non-first run's text node should also be written through the runs (or the rule answered one way), since the comment's premise "the text node holding the caret ... is the run `runStyleAt` names" fails there.
- evidence: read
- severity: medium

## Superscript/subscript toggles can never take off a node-level `script`
- where: packages/text-dom/src/selectionStyling.ts:25 (patchForToggle)
- scenario: node style `{ script: 'super' }`, runs carry no `script`. Cmd+Shift+= over a range: `current.script` is undefined, so the patch is `{ script: 'super' }` (same as the node — no visible change); pressing again yields `{ script: undefined }` — still drawn super from the node. Both presses do nothing visible, unlike the flag toggles, which read `nodeStyle` (`styleHasFlag`) and rewrite the node via `setFlagOverRange`. The script toggle ignores `nodeStyle` entirely, so a node-level script cannot be toggled off from the editor.
- evidence: read
- severity: low

## Pasted `white-space: pre-line` (or `white-space-collapse: preserve-breaks`) markup loses its line breaks
- where: packages/text-dom/src/pasteRuns.ts:34 (keepsSpace)
- scenario: clipboard HTML `<div style="white-space: pre-line">a\nb</div>`: `keepsSpace` matches only `pre|pre-wrap|break-spaces|preserve`, returns false, and the text node is split on `[ \t\n\f]+`, so the paste lands as `a b` where a browser renders two lines. `pre-line`/`preserve-breaks` should keep newlines while collapsing spaces.
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

<!-- done: 3 findings, files read: 35 -->
