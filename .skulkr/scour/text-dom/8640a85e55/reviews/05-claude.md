# text-dom findings (blind reviewer)

## A run's `script` is drawn full size in the overlay, while the canvas shrinks it
- where: packages/text-dom/src/domRuns.ts:228 (runsToDom)
- scenario: runs `[{ text: 'E=mc' }, { text: '2', script: 'super' }, { text: ' and more text' }]`. The canvas (`resolveRuns`, packages/text/src/runs/resolveRuns.ts:216-222) sets the `2` at `scriptMetricsFor(...)[script].size` (about 0.58 of the inherited size) and raises it by `script.shift`. `runsToDom` writes only `vertical-align: super`, which raises the glyph by the browser's own amount and keeps it at full size. Everything after the run sits further right in the overlay than on the canvas, a wrapped line can break in a different place, and the caret is out of step with what the canvas showed. The node-level case is handled (`typeset` in overlayPlace.ts:94-101 sizes the font from `scriptMetricsFor`), so the two places answer "how big is script text" differently.
- evidence: read
- severity: medium
- fix: packages/text-dom/src/domRuns.ts, packages/text-dom/src/runStyle.ts
- size: function
- cause: run-level script not given the preset's size/shift
- confidence: likely

## A restyle, an undo, a paste or a small-caps resplit turns a backward selection forward
- where: packages/text-dom/src/overlaySelection.ts:28 (selectOffsets)
- scenario: the user selects right to left with Shift+Left five times, then presses Cmd+B. `applyStyle` → `writeRunsPreservingSelection` → `selectOffsets` rebuilds the range with `addRange`, which puts the anchor at `start` and the focus at `end`. The user's next Shift+Left now shrinks the selection from its right end, where it should grow it to the left. `readSelectionOffsets` drops the direction (`TextEditSelection` has no field for it), so `restoreOverlayFocus`, `resplitSmallCaps` after every input in a small-caps run, and the history's `write` (via overlayEdits.ts) all reset it too.
- evidence: read
- severity: low
- fix: packages/text-dom/src/overlaySelection.ts, packages/text-dom/src/overlayTyping.ts
- size: function
- cause: selection read and written without its direction (use `setBaseAndExtent`)
- confidence: likely

## The overlay keeps the node style it opened with, and commit can write that old style back over a newer one
- where: packages/text-dom/src/useTextEdit.ts:107 (useTextEdit effect), packages/text-dom/src/heldNodeStyle.ts:32 (restyleNode)
- scenario: while an edit is open, a node-level control (align, wrap, font family, fill) writes the node's style through the host. `baseRef` is set once at open and changed only by `restyleNode`; `frame.style()` and `applyOverlayStyle` never read `getStyle` again, so the overlay keeps the old alignment, face, wrap and color while the canvas has hidden the node. Worse, once the edit has rewritten the node style (lowering a node underline holds a whole `TextStyle` snapshot in `nodeStyleRef`), `commit` writes that snapshot through `setStyle`/`onChange`, which puts back the font family or alignment the control just changed.
- evidence: read
- severity: medium
- fix: packages/text-dom/src/heldNodeStyle.ts, packages/text-dom/src/useTextEdit.ts, packages/text-dom/src/overlayDraft.ts
- size: design
- cause: node style snapshotted at open and held whole rather than as a delta
- confidence: likely

## `commitEdit` and `startEdit` read the editing id from render state, so a closure captured earlier drops the open edit
- where: packages/text-dom/src/useTextEdit.ts:58 (commit)
- scenario: a host binds `commitEdit` (or `startEdit`) once, e.g. in a listener added by an effect with no deps, or in a memoized toolbar handler. The user opens an edit on A and types. The stale `commit` has `editingId === null`, so it takes `id == null`, skips `finished`/`writeEdit`, and calls `setEditingId(null)`: the typing is thrown away, though `onEnd(A)` fires as if it had been written. `startEdit` already checks `liveIdRef` to decide whether an edit is open, but `commit` uses the state `editingId`, so the two disagree about which edit is open.
- evidence: read
- severity: low
- fix: packages/text-dom/src/useTextEdit.ts
- size: line
- cause: `commit` keyed on render state rather than `liveIdRef`
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
