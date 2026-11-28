# Findings: routing.interactions

## A press that only scrolls under a still pointer reports `moved: false` though its point moved
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:186 (useHandleDrag, `away`)
- scenario: press a handle and, without moving the pointer, scroll an ancestor with the wheel or a keyboard, then release. `localOf` folds the scroll into the release point, so `onEnd.point` differs from the press's local point, but `moved` is read off client coordinates only (`away` compares `clientX/Y` with the press), so it comes back `false`. A commit-on-end consumer reads that as "a press, not a drag" and throws away an edit whose point did change in the rect's space, the space every other field of `HandleDragEnd` is in.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/handleDrag/handleDrag.ts
- size: line
- cause: `moved` measured in client space, `point` in local space
- confidence: likely

## `overflow: clip` is taken for a sticky box's scrollport
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:93 (scrollersOf)
- scenario: a sticky `rectEl` (or one inside a sticky box) whose parent has `overflow: clip` and whose real scroller is further up. `styleOf(p)?.overflow !== 'visible'` treats the clip parent as the box's scrollport, so the sticky offset is read against the clip parent's rect and the real scroller is then added as a plain scroller beside it. CSS does not make a `clip` box a scroll container, so the sticky box sticks in the outer scroller; reading its stuck offset off the wrong box means a scroll during the drag shifts the reported local point by the scroll distance while the box stays stuck on screen.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/handleDrag/handleDrag.ts
- size: line
- cause: scroll-container test counts `clip`
- confidence: likely

## A missed release past the threshold but before activation is reported as a click under `missedRelease: 'click'`
- where: packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts:91 (startThresholdDrag, `missedRelease`)
- scenario: with `missedRelease: 'click'`, press, leave the window fast enough that no move inside it crossed the threshold, release outside, and come back: the first move seen has `buttons: 0` and lies far past the threshold. The session asks `missedRelease()` before `onMove` runs, so `activated` is still `false` and the answer is `'end'`. `onEnd` then skips `maybeActivate` (it only runs for `pointerup`) and calls `onClick` for a press that traveled hundreds of pixels. The option's own doc says only a release *below* the threshold is a click.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts
- size: line
- cause: threshold not checked for the missed-release move
- confidence: likely

## `undoKeyStep` hands the page the undo of a text field inside a closed shadow root
- where: packages/routing/src/interactions/keyHelpers.ts:75 (undoKeyStep)
- scenario: a page-level keydown handler calls `undoKeyStep(e)` while focus is in an `<input>` inside a closed shadow root. `e.target` names the host, and `isEditableTarget` can only look past a host through `target.shadowRoot`, which is `null` for a closed root, so the field is not seen as editable and Cmd+Z is returned as `'undo'`: the page undoes its own history instead of the field's text. `e.composedPath()[0]` is the focused element in that case only from inside, so the fix is to test the deepest target the event exposes, or `document.activeElement`'s chain.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/keyHelpers.ts, packages/gestures/src/ui/keyOwner.ts
- size: function
- cause: retargeted event target, closed shadow root
- confidence: likely

## Files read
packages/routing/src/interactions/browserReservedKeys.ts
packages/routing/src/interactions/carry/carry.ts
packages/routing/src/interactions/carry/index.ts
packages/routing/src/interactions/elementAt.ts
packages/routing/src/interactions/handleDrag/handleDrag.ts
packages/routing/src/interactions/keyHelpers.ts
packages/routing/src/interactions/pointerSession/index.ts
packages/routing/src/interactions/pointerSession/pointerSession.ts
packages/routing/src/interactions/pointerSession/swallowClick.ts
packages/routing/src/interactions/scratchKey.ts
packages/routing/src/interactions/sweep/index.ts
packages/routing/src/interactions/sweep/sweep.ts
packages/routing/src/interactions/thresholdDrag/index.ts
packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts

<!-- done: 4 findings, files read: 14 -->
