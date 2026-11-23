## Ending an edit and restarting the same node in one dispatch leaves the overlay open with no draft, so nothing typed afterwards is ever committed
- where: packages/text-dom/src/useTextEdit.ts:70 (startEdit; also cancelEdit at :53 and commit at :59)
- scenario: node `a` is being edited. In one event dispatch, `commit()` (e.g. from `onPointerDownOutside`'s capture-phase commit on a press that lands on the node outside the overlay) or `cancelEdit()` runs, followed by the host's `startEdit('a')` (a tool that starts editing on a press on a text node). `commit`/`cancelEdit` set `draftRef.current = null` and `setEditingId(null)`. `startEdit` reads `editingIdRef`, which `useLatest` has not updated yet and still holds `'a'`, so it neither commits nor resets anything, and calls `setEditingId('a')`. React batches null→'a' into an unchanged state, so the effect never runs its cleanup or setup. The old overlay stays mounted with its listeners, but `draftRef.current` stays `null`. Every later keystroke has `sendDraft` skip `onInput` (`draftRef.current?.changed` is undefined), and the next commit has `openEdit(overlay, null, …)` return `null`, so it writes nothing and the user's typing is lost. After `cancelEdit`, the canceled text also stays on screen as though it were live. Meanwhile `onEnd('a')`/`onStart('a')` both fired. Expected: either a fresh overlay seeded from the node, or the open edit kept with its draft.
- evidence: read
- severity: medium

## normalizeSmallCaps flattens any styling element nested inside a small-caps run span
- where: packages/text-dom/src/domRuns.ts:317 (normalizeSmallCaps, with piecesMatch at :283)
- scenario: a run in small caps (its own `fontVariantCaps` or the node's) in a face with no small caps of its own. The browser puts a styling element inside the run's span. This can be a native `formatBold`/`formatItalic`/`formatUnderline` beforeinput that the hook does not cancel (the iPadOS B/I/U bar, for example), whose `<b>`/`<u>` `styleStateFromElement` explicitly accepts, or a style span Chromium adds when merging. `piecesMatch` returns false for any child that is not a text node, `<br>`, break stand-in or small-caps piece, so `writeSmallCaps(el, text, …)` replaces the span's children with plain text and pieces. The nested `<b>`/`<u>` is dropped on the next `input`, and the bold or underline the browser just applied vanishes from the runs. Likewise, a non-small-caps run span holding a stale piece is rebuilt with `replaceChildren()` + `appendOverlayText`, dropping its nested elements. Expected: nested styling survives the re-split. Either it splits off into runs of its own, or the split rewrites only the text.
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

<!-- done: 2 findings, files read: 36 -->
