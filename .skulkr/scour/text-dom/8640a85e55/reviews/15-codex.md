# text-dom review saturation

Snapshot: 8640a85e55e43ca481ee4bb55113417ee3cce5cb

Scope came from `/private/tmp/skulkr-saturation/lists/text-dom.txt`. The checkout was detached and clean. Adjacent tests and dependencies were read for context. All findings have source-trace evidence. Browser and hook reproductions were reasoned through without executing the test suite.

## Pass ledger

The passes shared context and deduplicated findings by root cause.

| Pass | Focus | New | Cumulative | No-new streak |
| --- | --- | ---: | ---: | ---: |
| 1 | DOM serialization, source offsets, and clipboard whitespace and visibility | 3 | 3 | 0 |
| 2 | Session changes, carried drafts, and event ordering for armed styling | 2 | 5 | 0 |
| 3 | Direction-sensitive alignment, zoom, affine frames, and scroll placement | 1 | 6 | 0 |
| 4 | History snapshots, caret-holder restoration, undo grouping, and draft comparison | 0 | 6 | 1 |
| 5 | Keyboard routing, chrome focus, outside presses, and listener removal | 0 | 6 | 2 |
| 6 | Font loading, baseline measurement, deferred reveal, and frame teardown | 0 | 6 | 3 |

## Findings index

| ID | Location | Defect | Severity | Evidence |
| --- | --- | --- | --- | --- |
| TD-01 | packages/text-dom/src/domRuns.ts:77 | Break stand-ins discard nested DOM line breaks | Medium | Source trace |
| TD-02 | packages/text-dom/src/pasteRuns.ts:85 | Preserved trailing newline gains a second newline at a block boundary | Medium | Source trace |
| TD-03 | packages/text-dom/src/pasteRuns.ts:142 | Clipboard import inserts explicitly hidden text | Low | Source trace |
| TD-04 | packages/text-dom/src/overlayCarry.ts:39 | A canceled draft can reopen on the same node | Medium | Source trace |
| TD-05 | packages/text-dom/src/overlayTyping.ts:129 | An input before selectionchange can spend style at the wrong caret | Medium | Source trace |
| TD-06 | packages/text-dom/src/overlayDirection.ts:31 | Native DOM paragraph breaks are lost when choosing the alignment edge | Medium | Source trace |

## TD-01 — Break stand-ins discard nested DOM line breaks

In `domToRuns`, a `data-break` span is handled as an opaque subtree and read with `textContent`. Start with the overlay for `a\u2028b` and let a native editing command leave a `<br>` after the stand-in's newline inside the span. The subtree can also be supplied directly to the exported DOM readers as `a<span data-break="2028">\n<br></span>b`. The offset walkers count four code units, while serialization yields three, `a\u2028b`. The extra break should count in both representations and survive the draft and commit. A selection after the extra break is otherwise one unit past its position in the serialized runs.

## TD-02 — Preserved trailing newline gains a second newline at a block boundary

Pass `<div style="white-space:pre-wrap">a\n</div><div>b</div>` to the HTML clipboard path. Its preserve branch writes `a\n`, and `write` marks the current line occupied even though the string ended in a newline. The block boundary consequently queues another newline, yielding `a\n\nb`. A single separator, `a\nb`, is expected, as for the equivalent block ending in an explicit `<br>`. The preserved newline already reaches the boundary.

## TD-03 — Clipboard import inserts explicitly hidden text

Paste HTML containing `<span style="display:none">omitted</span><span>shown</span>` with a plain-text representation of `shown`. The HTML walker skips a fixed set of element names, visits the hidden span's children, and returns `omittedshown`. Since the HTML result is nonempty it overrides the plain-text representation. A subtree explicitly marked `display:none` contributes no visible text and should contribute no pasted characters.

## TD-04 — A canceled draft can reopen on the same node

Open node A, type a change, and rerender with `container: null` so the draft is set aside. Call `cancelEdit()` and `startEdit('A')` in one React event or `act` callback. The open counter advances, but there is no intermediate render with a null editing ID. `cancelEdit` clears the live draft ref, and `takeCarry` matches the old saved draft by ID alone. When a container becomes available, the fresh session restores the canceled text, selection, and history. It should open from the node. The existing container test uses a render between cancel and restart, which lets the null-ID effect clear the saved draft.

## TD-05 — An input before selectionchange can spend style at the wrong caret

Arm bold at the end of plain `ab`. In one task, move the DOM caret to offset zero with `Selection.collapse`, then dispatch a cancelable `insertText` beforeinput at that caret with data `X`. Selection change is reported in a later task. The typing handler reads the pending patch from the old caret, independently reads the new offsets, and inserts bold `X` at zero. The patch belongs only to the caret where it was armed. The expected runs contain plain `Xab`, with the armed style abandoned. Paste also reads the pending patch independently of the range it replaces.

## TD-06 — Native DOM paragraph breaks are lost when choosing the alignment edge

With a registered bidi engine, use an unwrapped editor with `direction: 'auto'` and `align: 'start'`. Let a native line break leave DOM equivalent to `123<div>אבג</div>`. The run serializer sees `123\nאבג`. Its first paragraph contains only digits and uses the LTR base level, so it anchors left. The alignment helper uses `textContent`, sees `123אבג` as one paragraph, and anchors right. A second line wider than the node makes the offset visible in the unwrapped placement. The alignment edge should use the same paragraph boundaries as the serialized text.

## Stop reason

Passes 4 through 6 found no new distinct defects, reaching the three-pass stopping condition.

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

<!-- done: 6 findings, files read: 36 -->
