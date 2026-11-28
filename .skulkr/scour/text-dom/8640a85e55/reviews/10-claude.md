# text-dom findings

## A node-level `{ px }` letter spacing ignores `pxScale`/zoom, while a run-level one divides by it
- where: packages/text-dom/src/overlayPlace.ts:113 (typeset)
- scenario: node style `letterSpacing: { px: 2 }`, pose with `zoom: 2` (pxScale default = zoom). Every caller resolves the node style at scale 1 (`resolveTextStyle(..., getPaint)` in useTextEdit.ts and heldNodeStyle.ts), so `style.letterSpacing` is 2 world units. `typeset` writes `2px` pre-scale under the zoom transform, which is 4 screen px. The canvas draws `{ px: 2 }` as 2 screen px, and a run's `{ px: 2 }` in the same overlay is written as `calc(2px / var(--weasel-zoom))` (domRuns.ts setLength), which is also 2 screen px. So node tracking in the overlay is `zoom`× wider than the canvas and than the run override beside it, and the line reflows when editing starts. One question, how a `{ px }` length reaches the overlay, gets two answers.
- evidence: read
- severity: medium
- fix: packages/text-dom/src/overlayPlace.ts, packages/text-dom/src/useTextEdit.ts, packages/text-dom/src/heldNodeStyle.ts
- size: function
- cause: `{ px }` resolved at scale 1, then not divided by pxScale
- confidence: likely

## A carried edit outlives its own commit when the same node is reopened before a render
- where: packages/text-dom/src/useTextEdit.ts:60 (commit), packages/text-dom/src/overlayCarry.ts:39 (takeCarry)
- scenario: an edit of `a` is carried while `container` is null. The host calls `commitEdit()` and then `startEdit('a')` in one handler. `commit` writes the carried draft through a detached overlay but leaves `carryRef` alone. It goes to `setEditingId(null)` and then `a` again with no render between, so the next effect calls `takeCarry('a', false)` and keeps the stale carry. When a container arrives, the overlay opens on the old content, history steps, armed style and draft, not on the node's current text. Its `finished` still compares against the original seed, so committing it again unchanged writes again. Committing should consume the carry.
- evidence: read
- severity: low
- fix: packages/text-dom/src/useTextEdit.ts, packages/text-dom/src/overlayCarry.ts
- size: line
- cause: commit reads the carry with peek, never takes it
- confidence: likely

## Test harness `dispatchBeforeInput` throws over the default select-all caret
- where: packages/text-dom/src/testing/textEditHarness.ts:126 (dispatchBeforeInput)
- scenario: `startEdit(id)` defaults to `caret: 'all'`, and `openingRange` uses `range.selectNodeContents(overlay)`, so the selection's `startContainer` is the overlay element. The hook does not handle a non-collapsed caret (`overlayTyping.ts` returns before `preventDefault`), so `dispatchEvent` returns true. The helper then casts the overlay element to `Text` and calls `node.insertData(...)`, which throws a TypeError. Even with a text-node range it never deletes the selected text, so it does not stand in for the browser's default it claims to imitate. A test typing straight after `startEdit` crashes or checks the wrong text.
- evidence: read
- severity: low
- size: function
- cause: assumes a collapsed caret inside a text node
- confidence: sure

## A paste keeps text its markup hides with `display: none`
- where: packages/text-dom/src/pasteRuns.ts:133 (htmlToRuns visit)
- scenario: clipboard HTML holding `<span style="display:none">x</span>` (or `visibility:hidden`), which office-suite markup and some copy handlers emit. `UNSEEN` filters only by tag name and the inline style is never consulted, so the hidden text lands in the node, though the module promises only "text a reader sees".
- evidence: read
- severity: low
- size: line
- cause: hidden content filtered by tag only
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

<!-- done: 4 findings, files read: 36 -->
