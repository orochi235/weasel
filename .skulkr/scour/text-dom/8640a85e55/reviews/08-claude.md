# text-dom findings

## A paste of preserved-whitespace text ending in a newline gains a blank line the source never showed
- where: packages/text-dom/src/pasteRuns.ts:146 (htmlToRuns, `visit` keep/spaces branch, with `write` at :83)
- scenario: clipboard HTML `<pre>a\n</pre><p>b</p>` (a code block copied from a page; pre content commonly ends in a newline), or a lone `<pre>a\n</pre>`. `write("a\n")` leaves `onLine = true`, so the `</pre>` boundary sets `gap.line` and `b` is written with a leading `\n`: runs read `"a\n\nb"`, and the lone case pastes `"a\n"`. A browser draws no empty last line for a block whose text ends in a line break (overlaySeed.ts's own header says so), so the source showed `a` / `b`, which should paste as `"a\nb"`, and the lone case as `"a"`. The `<br>` path does not have this problem: `lineBreak` clears `onLine`, but a kept `\n` inside text does not.
- evidence: read
- severity: low
- fix: packages/text-dom/src/pasteRuns.ts
- size: line
- cause: onLine not cleared by a kept trailing newline
- confidence: likely

## A paste through the HTML path keeps U+00A0 where the plain-text path, for the same copy, has spaces
- where: packages/text-dom/src/pasteRuns.ts:127 (htmlToRuns `collapsed`, and the keep branch at :146)
- scenario: copying `a  b` (two spaces) or text ending in a space next to an element in Chrome puts `a&nbsp; b` in `text/html` and `a  b` in `text/plain`. `clipboardRuns` prefers the HTML, and nothing there maps U+00A0 back to a space: `collapsed` splits only on `[ \t\n\f]`, so the run holds `a  b`. The pasted text then wraps differently (no break opportunity at the NBSP), and it differs from what the same copy pastes when the HTML is absent. The answer to "what do the clipboard's spaces become" depends on which flavor was present.
- evidence: read (the claim about Chrome's serialization comes from how Chrome is known to behave and was not run here)
- severity: low
- fix: packages/text-dom/src/pasteRuns.ts
- size: line
- cause: NBSP from markup serialization not normalized
- confidence: likely

## The edit overlay reads the selection and listens on the global document, so it is dead in a container in another document
- where: packages/text-dom/src/overlayListeners.ts:75 (listenToOverlay), packages/text-dom/src/overlaySelection.ts:13 (readSelectionOffsets)
- scenario: a host portals its canvas into an iframe (or a popup window) and passes a `container` there. `onBlur` checks `overlay.ownerDocument.hasFocus()`, but `selectionchange` and the outside `pointerdown` are registered on the global `document`, and `readSelectionOffsets` and `selectOffsets` use the global `window.getSelection()`. The iframe's selection never fires those listeners, and the outer selection is never inside the overlay, so `readSelectionOffsets` is always `null`. No range is ever published, so `applyStyleToSelection` and `toggleStyle` return early: the style shortcuts and chrome do nothing, and a press outside never commits. overlayScroll.ts:108, overlayOpen.ts:33/69 (`document.createRange`, `document.head`) and domOffsets.ts:108 have the same split between the global document and `ownerDocument`.
- evidence: read
- severity: low
- fix: packages/text-dom/src/overlayListeners.ts, packages/text-dom/src/overlaySelection.ts, packages/text-dom/src/overlayScroll.ts, packages/text-dom/src/overlayOpen.ts, packages/text-dom/src/editOverlay.ts, packages/text-dom/src/overlayTyping.ts
- size: design
- cause: global document/window instead of overlay.ownerDocument
- confidence: likely

## The plain text-edit harness keys its texts on a prototype-bearing object
- where: packages/text-dom/src/testing/textEditHarness.ts:7 (makeHarness)
- scenario: `makeHarness({})` followed by an edit of id `__proto__` (or a commit to it). `texts = { ...initial }` has `Object.prototype`, so `setText('__proto__', 'x')` assigns through the `__proto__` setter. A string is ignored there, so nothing is stored, `getText('__proto__')` stays `''`, and `getScreenPose('__proto__')` stays `null`. `makeRichHarness` beside it uses `Object.create(null)` for this exact reason, so the two harnesses give different answers for the same id.
- evidence: read
- severity: low
- size: line
- cause: user-keyed table with a prototype
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

<!-- done: 4 findings, files read: 36 -->
