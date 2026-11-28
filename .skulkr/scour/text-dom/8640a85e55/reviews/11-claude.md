# text-dom findings

## A line break typed at the start of a break stand-in swaps with the stand-in's own break
- where: packages/text-dom/src/domRuns.ts:44 (restoreBreak)
- scenario: a node's text is `a b`; the overlay holds `a`, `<span data-break="2028">\n</span>`, `b`. The caret sits at (stand-in's text node, 0), a position the browser can choose for the end of the first line. Shift+Enter is not intercepted (`onBeforeInput` only rewrites `insertText`), so the browser inserts `\n` into that text node, which becomes `\n\n`. `restoreBreak` swaps the *first* `\n` for U+2028, so the text reads back `a \nb` where the user typed `a\n b`. Typing a regular character there works only because it goes through the runs.
- evidence: read
- severity: low
- fix: packages/text-dom/src/domRuns.ts, packages/text-dom/src/overlayTyping.ts
- size: function
- cause: the stand-in's own break is identified by position (first `\n`), not by node
- confidence: likely

## A pasted `pre` block that ends in a newline gets an extra blank line before the next block
- where: packages/text-dom/src/pasteRuns.ts:83 (htmlToRuns `write` / `boundary`)
- scenario: the clipboard holds `<pre><code>x = 1\n</code></pre><p>next</p>`, which is how a code block copied from most sites looks. Kept text `x = 1\n` is written with `onLine = true`, so the `<p>` boundary asks for another line, and the paste reads `x = 1\n\nnext`. A browser draws `x = 1` and then `next` with no blank line between, because a trailing line feed at the end of a block opens no empty line. A `<br>` at the end of a block is already handled (`lineBreak` clears `onLine`); a kept `\n` at the end of text is not. The same paste with nothing after it leaves a trailing `\n`.
- evidence: read
- severity: low
- size: line
- cause: kept-whitespace text ending in `\n` leaves `onLine` set
- confidence: likely

## Pasted markup's hidden text is pasted
- where: packages/text-dom/src/pasteRuns.ts:137 (htmlToRuns `visit`)
- scenario: copied email or web markup holding `<span style="display:none">preheader text</span>` or an element with the `hidden` attribute. `visit` skips only `UNSEEN` tags, so that text lands in the node, although the reader never saw it and the browser's own text/plain for the same copy leaves it out. The module states its aim as "text a reader sees".
- evidence: read
- severity: low
- size: line
- cause: hidden elements (`hidden`, inline `display:none`) not treated as unseen
- confidence: likely

## Toggling a node-level underline off with no style writer still rewrites the runs
- where: packages/text-dom/src/selectionStyling.ts:93 (useSelectionStyling `applyStyle`)
- scenario: the host passes neither `setStyle` nor `onChange`. The node's style sets `underline: true`, and its runs carry `underline: true` too (as runs pasted or copied from elsewhere can). Cmd+U over the range gives `{ underline: false }`. Without a writer `unsetFlag` is `undefined`, so the patch falls through to `applyStyleToRange`, which strips the runs' own underline. The text still draws underlined, but the runs changed: a draft goes out, an undo step is recorded, and commit writes the stripped runs. `UseTextEditOptions.setStyle` documents that "without this or `onChange`, such a toggle is declined and nothing changes".
- evidence: read
- severity: low
- fix: packages/text-dom/src/selectionStyling.ts, packages/text-dom/src/textEditTypes.ts
- size: function
- cause: a declined unset still runs the additive path
- confidence: likely

## setStyle's docs leave out that taking off a node-level super/subscript needs it too
- where: packages/text-dom/src/textEditTypes.ts:143 (UseTextEditOptions.setStyle; also UseTextEditReturn.applyStyleToSelection)
- scenario: a node whose style sets `script: 'super'`; the host gives no `setStyle`/`onChange`, following the docs, which say a writer is needed "only to turn underline, strikethrough or overline off". `applyStyle`'s `unsetScript` branch also requires `canWriteStyle`. Without one, Cmd+Shift+= over the text applies `{ script: undefined }` additively, and nothing visible changes. The docs promise this toggle works without a writer.
- evidence: read
- severity: low
- size: line
- cause: the docs were not updated when `clearScriptOverRange` joined the rewrite path
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

<!-- done: 5 findings, files read: 36 -->
