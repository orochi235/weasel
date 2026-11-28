## A paste whose preserved white space ends a block with a line feed gains an extra blank line
- where: packages/text-dom/src/pasteRuns.ts:83 (htmlToRuns, `write`)
- scenario: paste HTML `<pre>a\n</pre><p>b</p>` (a code block copied with its trailing newline, which is how most copied `<pre>` blocks end). The `keep` text `"a\n"` goes through `write`, which sets `onLine = true` though the text ended its line. The closing `boundary(pre)` then sets `gap.line`, and `b` is written with a leading `\n`, giving `"a\n\nb"`. A browser draws `a` then `b` with no empty line between them, because a line feed at the end of a block opens no line box. The `<br>` path gets this right: `lineBreak` resets `onLine = false` after its `\n`, so `<p>a<br></p><p>b</p>` reads `"a\nb"`. The `keep`/`spaces` text path does not, so the same visual break comes out two ways. A paste that ends there (`<pre>a\n</pre>` alone) keeps a trailing `\n`, which the canvas shows as an extra break.
- evidence: read
- severity: low
- fix: packages/text-dom/src/pasteRuns.ts
- size: line
- cause: onLine set true for text ending in a line feed
- confidence: likely

## Arming a style at the caret does not seal the undo step, so the next character joins the typing before it
- where: packages/text-dom/src/selectionStyling.ts:139 (applyStyle, collapsed-caret arm path)
- scenario: type `abc`. The history opens a `type` step with its caret at 3. Press Cmd+B: `applyStyleToSelection` runs `before('other')`, then `applyStyle` only arms `{bold: true}`. Nothing changed, so `after()` returns early and leaves `open` as it was. Type `d`: `before('type')` sees caret 3, which equals `open.caret`, so the bold `d` joins the `abc` step. One Undo then removes `abcd` together and the armed bold with it, though the restyle sat between them. The history's own rule (overlayHistory.ts:18–19: "anything else is a step alone") counts a restyle as a boundary. Arming should `seal()` the history the way `onCompositionStart` does.
- evidence: read
- severity: low
- fix: packages/text-dom/src/selectionStyling.ts, packages/text-dom/src/overlayHistory.ts
- size: line
- cause: a no-content `other` change leaves the open step unsealed
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
