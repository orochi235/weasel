# Audit round 76 — text-dom (blind reviewer)

## normalizeSmallCaps rewrites a run span from `sourceText`, which drops the newline a block inside it reads as
- where: packages/text-dom/src/domRuns.ts:250 (sourceText), used at domRuns.ts:300 and piecesMatch at domRuns.ts:262
- scenario: a small-caps run span (face without its own small caps) comes to hold a `<div>`/`<p>` after earlier text (any editing command or extension that splits a block inside the overlay). `domToRuns` and `overlayPieces` both read the block's boundary as one `\n` (`BLOCK_TAGS`), but `sourceText` walks only text, `<br>` and break stand-ins and descends into the block with no newline. `piecesMatch` then fails (the `<div>` child is no piece), and `writeSmallCaps(el, text, …)` replaces the span's children with the `sourceText` string. The newline is gone from the text, every caret offset after it moves by one, and the `before` passed to later runs (which decides where `capitalize` starts a word) also misses it. It should either count a block's newline the same way `domToRuns` does, or leave a span holding a block alone.
- evidence: read
- severity: low

## The overlay's `::selection` rule matches the overlay element only, not the run spans that hold its text
- where: packages/text-dom/src/overlayOpen.ts:62 (installSelectionStyle)
- scenario: a node with runs, or a small-caps node, sets `selectionBackground`/`selectionColor`. Every character of its text sits inside a `<span data-run>` (or a small-caps piece) that `runsToDom` writes. The rule is `.weasel-text-edit-N::selection { … }`. That matches only the overlay's own selection pseudo-element. Engines without CSS highlight inheritance take a descendant's `::selection` from its own originating element and not from its parent's, so the configured colors would not show on styled text in those engines. Only bare plain-text overlays would get them. `.cls::selection, .cls *::selection` would reach the text in every engine. (I read the code. The claim about which engines lack highlight inheritance is inference; I did not run it.)
- evidence: read (engine behavior inferred)
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

<!-- done: 2 findings, files read: 36 -->
