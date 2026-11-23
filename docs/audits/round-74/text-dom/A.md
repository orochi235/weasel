# Audit round 74 — text-dom — findings

## The armed style treats `italic: false` as "absent", though a run's italic is tri-state, so Cmd+I at a caret in an upright run under an italic node does nothing
- where: packages/text-dom/src/armedStyle.ts:10 (FLAGS), :17 (withArmed), :37 (armPatch)
- scenario: node style `italic: true`, runs `[{ text: 'ab', italic: false }]` (upright, which `runs.ts` documents and `toRun`/`runsToDom` round-trip). Caret collapsed at 2, press Cmd+I. `patchForToggle` returns `{ italic: false }` (node flag on). `armPatch`: `caret.italic` is `false`, the patched target has `italic` deleted (`patchRun` drops `false`), and the flag comparison `(false ?? false) === (undefined ?? false)` calls them equal, so nothing is armed; the next character types upright. The same toggle over a selected range writes the patch through `applyStyleToRange`, deletes the run's `italic: false`, and the range turns italic. Even if armed, `withArmed` deletes a `false` key, so an armed `italic: false` would let the character inherit the node's italic instead of reading upright. Should: compare and lay `italic` as the tri-state it is (absent ≠ `false`), so the caret answers the toggle as the range does.
- evidence: read (plus packages/text/src/runs/rangeStyle.ts:205 patchRun, packages/text/src/runs.ts:29)
- severity: medium

## Pasted `white-space: pre-line` / `white-space-collapse: preserve-breaks` keep every space and tab, because `\b` matches before the hyphen
- where: packages/text-dom/src/pasteRuns.ts:33 (keepsSpace)
- scenario: paste `<div style="white-space: pre-line">a    b</div>`. The regex `/^(pre|pre-wrap|break-spaces|preserve)\b/` matches `pre` in `pre-line` (word boundary between `e` and `-`), and `preserve` in `preserve-breaks`, so `keepsSpace` returns true and the text lands as `a    b`. A browser draws `a b`: both values collapse spaces and tabs and keep only line breaks. Should: anchor the alternatives to the whole value (or the first token), and treat pre-line/preserve-breaks as collapsing spaces but keeping newlines.
- evidence: read
- severity: low

## A `container` change mid-edit throws away everything typed, with no commit, no `onEnd` and no `onInput`
- where: packages/text-dom/src/useTextEdit.ts:136 (the overlay effect's deps include `opts.container`)
- scenario: the host re-renders with a different container element (a remounted canvas host, a ref attached late) while an edit of `n1` is open and the user has typed. The effect's cleanup removes the overlay, clears the selection, drops the held node style and the history; the effect then reopens on the same `editingId`, seeding a fresh overlay from `getText`/`getRuns`, which still hold the pre-edit text. The typed text and any rewritten node style are lost silently, `onEnd`/`onStart` are not reported, and an `onInput` host's draft copy is left showing text that no longer exists. Should: carry the overlay's current runs/selection/held style over to the new container (or commit before tearing down).
- evidence: read
- severity: medium

## `startEdit` with no container leaves an edit "open" that shows nothing and nothing ends
- where: packages/text-dom/src/useTextEdit.ts:85 (effect returns early when `!container`)
- scenario: `startEdit('n1')` runs before the container ref is attached (`opts.container === null`). `setEditingId` reports `onStart('n1')` and `editingId` becomes `'n1'`, so the host hides the node (`isHidden: n => n.id === editingId`), but the effect returns without an overlay or listeners: no blur, press-outside or Enter can end it, and the node stays invisible until the host calls `cancelEdit`. If the container then arrives the effect opens late, but if it never does the node stays hidden. Should: not enter the editing state (or not report `onStart`) when there is nowhere to mount.
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

<!-- done: 4 findings, files read: 35 -->
