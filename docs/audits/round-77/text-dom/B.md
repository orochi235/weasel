# Audit round 77, text-dom, blind reviewer

## A CRLF split across two runs draws as two lines in the overlay, one on the canvas
- where: packages/text-dom/src/domRuns.ts:52 (appendOverlayText), called per run from runsToDom:188
- scenario: runs `[{ text: 'a\r', bold: true }, { text: '\nb' }]`, for example after a styling that ends exactly between the CR and the LF. `appendOverlayText` is called once per run, so `text.charCodeAt(i + 1)` for the trailing CR is `NaN`, not 10. The CR becomes a `<span data-break="d">\n</span>` and the next run's LF is a real `\n`. The browser breaks twice, while the canvas lays out the concatenated `\r\n` as one break. The overlay shows an extra empty line and every following line sits one line low. It should leave a CR alone when the next run's text opens with an LF. The round trip through `domToRuns` is lossless; only the overlay's rendering is wrong.
- evidence: read (that the canvas joins the CRLF across runs into one break is inferred from the run model concatenating text)
- severity: low

## `runsToDom` and `normalizeSmallCaps` read a run's `lang: ''` two ways, so small-caps pieces are rewritten on the first input
- where: packages/text-dom/src/domRuns.ts:194 (runsToDom: `run.lang ?? base.lang`) vs domRuns.ts:299 (normalizeSmallCaps: `el.hasAttribute('lang') ? … : inherited`)
- scenario: the node has `lang: 'tr'` and small caps (no own small-caps face), and a seeded run has `lang: ''`. `runsToDom` passes `''` to `smallCapsPieces`, because `??` keeps an empty string, and writes no `lang` attribute, because `if (run.lang)` is false. `normalizeSmallCaps` then finds no attribute and inherits the overlay's `tr`. With `textTransform: 'capitalize'` or `'uppercase'`, a dotted/dotless i is split differently under the two locales. `piecesMatch` fails on the first keystroke and the run is rewritten into different pieces, so the glyphs change the moment the user types anything. One reading of `''` should serve both functions; `toRun` already treats it as none.
- evidence: read
- severity: low

## A carried edit waits on the faces of the node's stored runs, not on what the overlay actually holds
- where: packages/text-dom/src/editOverlay.ts:63 (openEditOverlay: `holdForFaces(style, node.runs ?? [])`)
- scenario: during an edit, the user applies `fontFamily: 'Inter'` to a range, then the host moves the edit to another container. The new overlay takes `node.carried.content`, which holds the Inter run. The font hold, however, is computed from `getRuns(id)`, the node's runs from before the edit, so it never waits for Inter. The overlay is measured and shown in the fallback face, and `place` is not re-run when Inter arrives (the one re-measure is `release`, tied to the hold). It should read the faces from the carried content (`domToRuns` of the overlay) when the edit is carried.
- evidence: read
- severity: low

## Handing focus back from editor chrome uses a bare `overlay.focus`, where the overlay's own focus path keeps a clipped box's scroll
- where: packages/text-dom/src/overlaySelection.ts:79 (restoreOverlayFocus) vs overlayScroll.ts:96 (focus)
- scenario: the node clips its text (`pose.clip`) and has been scrolled. The user has typed, so the scroller is armed. They click a toolbar button that takes focus, and the patch lands. `restoreOverlayFocus` calls `overlay.focus({ preventScroll: true })`. `overlayScroll.focus` exists because Chromium still scrolls a freshly focused box regardless, and it saves and restores `scrollLeft`/`scrollTop` around the call. Because the scroller is armed, `onScroll` records the jump as the user's own offset, so the text jumps toward the start; `reveal` only pulls the caret back to the nearest edge. Focusing the overlay is a decision answered two ways; both callers should go through the scroller's `focus`.
- evidence: read (the Chromium scroll-on-focus behavior is taken from the comment on `overlayScroll`, not observed here)
- severity: low

## The rich test harnesses read and write their node table through the prototype chain
- where: packages/text-dom/src/testing/textEditHarness.ts:37-42 (makeRichHarness: `data[id]?.text`, `data[id] = { ...data[id], text }`)
- scenario: a test whose node id is `'__proto__'`. `setText`/`setRuns` assign `data['__proto__'] = {...}`, which replaces the table's prototype instead of storing an entry. `getText('constructor')` reads `Object`'s constructor. `makeHarness` in the same file already guards with `Object.hasOwn`, and `getScreenPose` here does too, so these two lines answer the same lookup a second way.
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
