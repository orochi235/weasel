## The overlay resolves the node's `{ px }` lengths at view scale 1, so node-level `{ px }` letter spacing (and font size) is off by the view scale
- where: packages/text-dom/src/useTextEdit.ts:111 (useTextEdit effect), packages/text-dom/src/heldNodeStyle.ts:37 (restyleNode)
- scenario: a node with `style.letterSpacing: { px: 5 }`, edited at `pose.zoom = 2` (so `pxScale` defaults to 2). The canvas resolves the tracking as 5 / 2 = 2.5 world units, which is 5 screen px. The overlay calls `resolveTextStyle(style, paint)` with no third argument, which defaults `scale` to 1, so `style.letterSpacing` is 5. `typeset` (overlayPlace.ts:118) then writes `letter-spacing: 5px` pre-scale, and the zoom transform shows it as 10 screen px. The overlay's lines come out wider than the canvas's and wrap in different places. A `{ px }` node `fontSize` is resolved the same way (it feeds `typeset`'s world→screen factor and `baselineDrop`'s canvas side). Run-level `{ px }` lengths are handled correctly through `ZOOM_PROPERTY`; only the node level is wrong.
- evidence: read (`resolveTextStyle(style?, paint?, scale = 1)` in packages/text/src/textStyle.ts:221; textStyle.test.ts:164 shows `{ px: 5 }` at scale 2 resolves to 2.5)
- severity: medium
- fix: packages/text-dom/src/useTextEdit.ts, packages/text-dom/src/heldNodeStyle.ts, packages/text-dom/src/overlayPlace.ts
- size: function
- cause: view scale never passed to resolveTextStyle
- confidence: likely

## A carried edit outlives a cancel or commit when the same node is reopened before a render, so the new edit opens on the old session's content, history and armed style
- where: packages/text-dom/src/overlayCarry.ts:39 (takeCarry), packages/text-dom/src/useTextEdit.ts:58 (commit) and :52 (cancelEdit)
- scenario: an edit of `a` is open when `container` goes to `null`, so `stashCarry` carries it. The host then calls `cancelEdit()` and, in the same event, `startEdit('a')`, for example to restart the edit. React batches `null → 'a'` into one render, so the effect never runs `takeCarry(null, …)`, which is the only thing that clears `carryRef`. When a container returns, `takeCarry('a', true)` hands the new edit the canceled session's DOM, draft, undo steps, held node style and armed style. The cancel is undone, and Undo steps into the previous session. `commit` has the same gap: it reads through `peekCarry` but never drops the carried edit.
- evidence: read
- severity: low
- fix: packages/text-dom/src/overlayCarry.ts, packages/text-dom/src/useTextEdit.ts
- size: line
- cause: ending an edit does not clear the carry
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
