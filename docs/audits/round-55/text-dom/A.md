# Audit round 55 — text-dom

## A cancel or commit whose `onEnd` moves focus re-enters through the overlay's blur and writes the edit (again)
- where: packages/text-dom/src/useTextEdit.ts:51 (cancelEdit), :53 (commit); packages/text-dom/src/editSession.ts:15 (setEditingId); packages/text-dom/src/overlayListeners.ts:51 (onBlur)
- scenario: `setEditingId(null)` calls `onEnd(prev)` synchronously, from inside `cancelEdit`/`commit`, while the overlay is still mounted, focused and listening (the effect's cleanup only runs after React commits the re-render). A host whose `onEnd` focuses the canvas (or anything not `isEditorChrome`) blurs the overlay right then; `onBlur` calls the `commit` closure, whose `editingId` is still the id and whose `overlayRef`/`draftRef` still hold the overlay, so `draft.finished` returns the edit and `writeEdit` writes it. For Escape (`escape: 'cancel'`), the edit the user threw away gets written; for Enter, it is written twice (two `onChange`/`setText` calls, two undo steps). The trailing `setEditingId(null)` is a no-op because `live.current` is already `null`, so nothing guards the write. Should: `commit` bail out once the session it closes has ended (e.g. check the live editing id / clear `draftRef` before calling `setEditingId(null)`), so a blur fired from `onEnd` does nothing. `useSceneTextEdit` forwards `onEnd` straight to the app's own `onEnd`.
- evidence: read
- severity: medium

## A clipped node's scroll box keeps catching presses after its pose goes `null`
- where: packages/text-dom/src/overlayPlace.ts:68 (placeOverlay)
- scenario: a node placed with `pose.clip` gets `placeScrolled`, which sets its scroll box to `pointerEvents: 'auto'`, `overflow: auto` and the box's size. When `getScreenPose` later returns `null` (node deleted by a collaborator/undo, or scrolled out of what the host projects), `placeOverlay` only hides the overlay element; the scroll box keeps its size, position and `pointer-events: auto`. Presses on that empty rectangle land on the box: the canvas under it never receives them, and `onPointerDownOutside` skips them because `scroll.contains(target)` is true, so the edit does not commit either. Should: on a `null` pose also reset the scroll box (as `placeLoose` does: zero size, `pointerEvents: 'none'`), or hide `boxes.clip`.
- evidence: read
- severity: low

## Placing the overlay after a node restyle still reads the style the edit opened with
- where: packages/text-dom/src/editOverlay.ts:59 (place), with packages/text-dom/src/heldNodeStyle.ts:28 (restyleNode)
- scenario: lowering a node flag (`setFlagOverRange`, e.g. Cmd+I in an italic node) or an undo/redo of one calls `restyleNode`, which re-resolves `baseRef.current` and re-dresses the overlay in the new style. But `place` closes over `node.style` from `openEditOverlay`, and every frame passes that to `placeOverlay` → `typeset`/`baselineDrop`/`overlayAlignEdge`, so the baseline correction and script metrics stay computed for the old face (`fontStyle`/`fontWeight`) for the rest of the edit. Separately, `applyOverlayStyle` in `restyleNode` resets `font` (world `fontSize`), `lineHeight` and `padding` to node values, which `placeScrolled`/`typeset` had set from the pose, so the overlay is laid out wrong until the next frame's `place`. One decision (the overlay's current style) answered from two sources. Should: `place` read the held/resolved style (`baseRef`'s full resolved style), and a restyle re-place at once.
- evidence: read
- severity: low

## Undo/redo with no readable selection drops the current state instead of moving it to the other stack
- where: packages/text-dom/src/overlayHistory.ts:59 (step)
- scenario: `step` pops the target, then pushes `host.read()` onto the opposite stack only if it is non-null. `read` returns `null` when the DOM selection is outside the overlay and no range has been published yet (`selectionRef` is null until the first `syncSelection`/`publishRange`). In that state an undo (from `historyUndo` `beforeinput` or a chrome-driven call) applies the target and loses the present state, so Redo cannot return to it. Should: refuse the step (push the target back) when the present cannot be read, rather than make an unrecoverable step.
- evidence: read
- severity: low

## A plain-text paste keeps a lone CR that an HTML paste turns into LF
- where: packages/text-dom/src/pasteRuns.ts:133 (clipboardRuns) vs :83 (htmlToRuns)
- scenario: `htmlToRuns` normalizes `\r\n?` → `\n`, but the plain-text fallback only replaces `\r\n`, so a classic-Mac/Excel plain-text clipboard `"a\rb"` lands as a U+000D in the node (written into the overlay as a `data-break` stand-in), while the same text arriving as HTML lands as `\n`. The same input is stored two ways depending on which flavor the source app put on the clipboard. Should: use the same `/\r\n?/g` normalization on the plain-text path.
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

<!-- done: 5 findings, files read: 35 -->
