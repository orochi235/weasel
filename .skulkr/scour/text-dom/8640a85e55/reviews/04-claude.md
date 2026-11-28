## A `<br>` closing the pasted markup's last line pastes as an extra trailing newline
- where: packages/text-dom/src/pasteRuns.ts:146 (htmlToRuns, `visit` BR branch / `lineBreak`)
- scenario: clipboard `text/html` of `<p>a<br></p>` (or `<div>a<br></div>` last in the fragment) → `lineBreak` writes `'\n'` unconditionally, so `htmlToRuns` returns `[{ text: 'a\n' }]`, and the paste leaves a newline the source never showed. A browser draws no line for a `<br>` that ends a block. The same `<br>` in the middle of the fragment comes out right, because `onLine = false` stops the next block's boundary from adding a second newline. Only the last one survives, since nothing later absorbs it.
- evidence: read (traced `write`/`boundary`/`trimSpace` by hand for `<p>a<br></p>`, `<div>a<br></div>b` and `<p>a</p><br><p>b</p>`)
- severity: low
- fix: packages/text-dom/src/pasteRuns.ts
- size: function
- cause: a block-final break is written eagerly rather than held as a pending gap
- confidence: likely

## The edit's teardown leaves `focusRef` pointing at the removed overlay's scroller
- where: packages/text-dom/src/useTextEdit.ts:121 (useTextEdit effect; set at `focusRef.current = boxes.scroller.focus`, never reset in the cleanup)
- scenario: open an edit, then commit or cancel it → the cleanup resets `placeRef`, `overlayRef` and `historyRef`, but `focusRef.current` still holds the old `OverlayScroll.focus` closure. That closure keeps the detached overlay and its scroll box alive until the next edit opens. Every other ref the effect sets is reset on the way out, so this one is left behind by teardown.
- evidence: read
- severity: low
- size: line
- cause: missing reset in effect cleanup
- confidence: sure

## `commit` / `startEdit` read the edit id from the render they were made in, not the live one
- where: packages/text-dom/src/useTextEdit.ts:63 (commit, `const id = editingId`)
- scenario: a host binds `startEdit` once, e.g. a dispatcher action registered at mount, or any handler whose closure predates the edit. The edit on A is open and the host calls that stale `startEdit('B')` → `liveIdRef` says A is open, so it calls the `commit` from that old render, whose `editingId` is `null`. That takes the `id == null` branch: `setEditingId(null)` reports `onEnd('A')`, and A's typed text is dropped without being written. With a fresh closure the same call writes A. `setEditingId` already keeps `liveIdRef` for exactly this ahead-of-render reading, and `commit` ignores it.
- evidence: read
- severity: low
- size: line
- cause: render-state id where the live ref exists
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

<!-- done: 3 findings, files read: 36 -->
