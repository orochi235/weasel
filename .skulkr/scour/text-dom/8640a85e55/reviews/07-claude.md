# text-dom findings

## A node's `{ px }` letterSpacing is scaled by the zoom in the overlay, where the canvas keeps it in screen pixels
- where: packages/text-dom/src/overlayPlace.ts:120 (typeset)
- scenario: a node with `style.letterSpacing: { px: 2 }`, edited at view zoom 3. `useTextEdit` (and `restyleNode` in heldNodeStyle.ts:38) resolve the style with `resolveTextStyle(style, paint)`, no scale, so `style.letterSpacing` is 2 as if it were world units. With `pose.zoom` set, `typeset` writes `letter-spacing: 2px` pre-scale and the transform makes it 6 screen px; with no `pose.zoom`, `scale = pose.fontSize / style.fontSize` (3) multiplies it to 6px as well. The canvas draws 2 screen px (`pose.pxScale` is the scale a `{ px }` length resolves against), so every glyph in the overlay drifts further from the canvas text the longer the line. Should divide a `{ px }` tracking by `pose.pxScale ?? pose.zoom` under a transform (as `runsToDom`'s `setLength` does for runs via `--weasel-zoom`) and not multiply it at all in the screen-pixel path.
- evidence: read
- severity: medium
- fix: packages/text-dom/src/overlayPlace.ts, packages/text-dom/src/useTextEdit.ts, packages/text-dom/src/heldNodeStyle.ts
- size: function
- cause: `{ px }` length resolved at scale 1 and then treated as world units
- confidence: likely

## A CR kept before an LF draws as a space in the overlay, where the comment says it draws nothing
- where: packages/text-dom/src/domRuns.ts:57 (appendOverlayText)
- scenario: text `"ab\r\ncd"` with `align: 'right'` and `wrap: false`. The CR is left in the text node; CSS Text 3 treats U+000D as a space, and under the overlay's `white-space: pre` a trailing preserved space does not hang, so line one is a space wider than on the canvas (which draws the CR as nothing): the right-aligned first line sits one space left of the canvas glyphs, and `max-content` width grows by it. Should keep the CR as a stand-in that takes no advance (or a `data-break`-style span with zero width), so source offsets stay equal while nothing is drawn.
- evidence: read
- severity: low
- size: function
- cause: CR assumed invisible in CSS preserved white space
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
