## An unclipped overlay inherits the container's CSS `direction`, so `direction: 'auto'` text with no strong character lays out RTL in an RTL page while the canvas sets it LTR
- where: packages/text-dom/src/overlayDirection.ts:17 (applyOverlayDirection)
- scenario: host page or container is `dir="rtl"`; a node with `direction: 'auto'`, `align: 'start'` holds digits only, or is empty when an edit opens on it. `applyOverlayDirection` clears `direction` to `''`, so the overlay inherits `rtl` from the container. Under `unicode-bidi: plaintext`, a paragraph with no strong character falls back to that inherited direction, and `text-align: start` follows it, so the caret and text sit at the right edge. The canvas's `paragraphDirection` returns `ltr` for the same text, and `overlayAlignEdge` (canvas side) anchors left. So the overlay and the canvas disagree. `placeScrolled` pins `direction: ltr` on its box, so a clipping node inherits LTR, but `placeLoose`'s `bareBox` sets nothing. The two placements answer the fallback direction differently. It should be `ltr` on both, as the canvas does.
- evidence: read (paragraphDirection in packages/text/src/layout/bidiRegistry.ts returns the level of an `auto` analysis, LTR with no strong character)
- severity: low
- fix: packages/text-dom/src/overlayDirection.ts, packages/text-dom/src/overlayPlace.ts
- size: line
- cause: auto direction leaves CSS `direction` to inheritance
- confidence: likely

## A U+2028 (or other non-LF hard break) reads as a paragraph separator in the overlay's alignment and bidi, because its stand-in holds `\n`
- where: packages/text-dom/src/overlayDirection.ts:31 (overlayAlignEdge)
- scenario: node text `" שלום"` with `direction: 'auto'`, `align: 'start'`, unwrapped. `runsToDom`/`appendOverlayText` write the LS as `<span data-break>\n</span>`, so `el.textContent` is `"\nשלום"`. `paragraphDirection` stops at the `\n` (a paragraph separator) and returns `ltr` for the empty first paragraph, so the overlay is anchored left. The canvas reads the source, where LS is not a paragraph separator, so its first paragraph is RTL and it anchors right. The same stand-in also gives the browser's `unicode-bidi: plaintext` a paragraph break the canvas does not have, so the second line resolves its own direction. Alignment should be read from the restored source text, as `domToRuns` reads it, not from `textContent`.
- evidence: read
- severity: low
- fix: packages/text-dom/src/overlayDirection.ts, packages/text-dom/src/domRuns.ts
- size: function
- cause: textContent read instead of restored source text
- confidence: likely

## `setStyle`'s docs say it is needed only for underline/strikethrough/overline, but taking off a node-level `script` needs it too
- where: packages/text-dom/src/textEditTypes.ts:141 (UseTextEditOptions.setStyle; also applyStyleToSelection's doc at :287)
- scenario: a node whose `TextStyle` has `script: 'super'`. The host supplies neither `setStyle` nor `onChange`, which the docs say is fine because only the three rule flags need them. Cmd+Shift+= over a range gives `{ script: undefined }`. `selectionStyling.applyStyle` takes the `clearScriptOverRange` rewrite only when `canWriteStyle` is true. Otherwise it falls through to `applyStyleToRange`, and the node's script still shows, so nothing visible changes. The docs list only the flags as needing the rewrite, and bold and italic as needing nothing, so a host reading them cannot predict this. The `applyStyleToSelection` doc likewise describes the node rewrite only for flags.
- evidence: read
- severity: low
- fix: packages/text-dom/src/textEditTypes.ts
- size: line
- cause: docs not updated when clearScriptOverRange path was added
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

<!-- done: 3 findings, files read: 36 -->
