# Findings: path-tools.pathEdit (round 53)

## insertPathAnchor selects an anchor even when the insert was not committed
- where: packages/path-tools/src/pathEdit/insertPathAnchor.ts:48 (insertPathAnchorAction.run)
- scenario: Alt+click on a segment of a path whose extension cannot finish the edit. One example is a constrained path whose solver does not converge, where `finishEdit` returns null. `dep.applyEdit` then commits nothing, since `editOps` returns `[]` (core `canvas/deps/editAnchors.ts:168-169`). The action still runs `dep.setSelectedAnchors([inserted])`. `inserted` is the index the new anchor would have had, so the unchanged path ends up with a different existing anchor selected: the segment's end anchor, or no anchor at all on a closed path's closing segment. A following Delete or nudge then acts on an anchor the user never picked. The selection should only change when the insert actually commits; one way is the `select` argument `applyEdit` already takes.
- evidence: read
- severity: medium

## cutPathAtAnchor is enabled for clicks that cut nothing
- where: packages/path-tools/src/pathEdit/anchorEditing.ts:236 (cutPathAtAnchorAction.enabled)
- scenario: `enabled` returns true whenever a path is open. Two kinds of Alt+Shift+click still change nothing in `run`: one that misses every anchor (`anchorUnder` = -1), and one on an anchor of an open subpath, where `openSubpathAt` is a no-op. The 2026-11-10 ruling in docs/unruled.md:384 says an edit that would change nothing is disabled with `NotApplicable`, and that `enabled` asks the same question `run` answers. `enabled` is given `at` (insertPathAnchor's `enabled` uses it), so it could resolve the anchor and test `openSubpathAt` on a scratch decode (`anchorEditWouldChange`). As written, the action claims the click, so the dispatcher never falls through to another binding, and the hover pump and palette show it as available.
- evidence: read
- severity: low

## setAnchorField stays enabled when the entry would change nothing
- where: packages/path-tools/src/pathEdit/anchorFields.ts:41 (setAnchorFieldAction.enabled)
- scenario: `enabled` is only `requiresAnchorSelection`. With `{ field: 'x', to: <the anchor's current x> }`, a handle field on anchors with no handles, a non-finite `to`/`by` (`writeAnchorField` returns false for it), or a selection that names no anchor of the path (left by an undo that shortened it), `run` commits nothing but the action reports enabled. That breaks the 2026-11-10 ruling (docs/unruled.md:384), which the sibling actions follow: nudge, delete, average, join and the handle commands all test `anchorEditWouldChange` with the same edit `run` makes. `enabled` receives params as its 4th argument (nudge reads `magnitude` there), so it could test `writeAnchorField`'s result the same way.
- evidence: read
- severity: low

## A marquee that catches no anchors leaves the selected extension mark selected
- where: packages/path-tools/src/pathEdit/anchorEditing.ts:286-290 (areaSelectAnchorsAction onMove/onEnd)
- scenario: Select an extension mark, such as a constraint mark, then drag a non-additive marquee over empty space. `onMove` calls `dep.setSelectedAnchors([])`. Core's `setSelectedAnchors` clears the mark only when the new set is non-empty (core `canvas/deps/editAnchors.ts:119`), so the mark stays selected, and a following Delete deletes it. A bare click on empty space clears both (`selectAnchorAction`, lines 145-146), so the same "select nothing" intent gets two answers. The reverse case: when the marquee sweeps anchors (which clears the mark) and is then canceled, `onEnd` restores only `base` anchors, and the mark selected before the drag is lost.
- evidence: read
- severity: low

## Anchor drag and segment bend handle a frame no extension can finish in opposite ways, and the anchor drag finishes its commit twice
- where: packages/path-tools/src/pathEdit/editAnchors/editAnchors.ts:175-183, 379 (track, onEnd) vs packages/path-tools/src/pathEdit/bendSegment.ts:65-71
- scenario: Take a drag whose latest frame `finishEdit` refuses (returns null). `editAnchors` drops that frame, keeps showing the last finishable one, and on release commits it. `bendSegment` keeps the unfinished frame: its preview shows no ghost (`createPathEditPreview` returns null for that frame), and on release `applyEdit` commits nothing, so the whole bend is lost. So the same question, what an unfinishable frame does, gets two answers, and releasing a bend just past a constraint's limit throws away the gesture while an anchor drag keeps the last good shape. Separately, `editAnchors` commits `scratch.currentPose`, which is already the output of `finishEdit`, together with the origins of the raw frame. `applyEdit` runs `finishEdit` again (core `editAnchors.ts:168`), so for any extension whose finish is not idempotent (the constraint solver pins whichever points differ from the node as stored, which now includes the points it moved itself), the commit can differ from the frame the preview showed. `bendSegment` and `insertPathAnchor` pass the raw frame instead.
- evidence: read
- severity: low

## Files read
packages/path-tools/src/pathEdit/aidSettings.ts
packages/path-tools/src/pathEdit/anchorEditing.ts
packages/path-tools/src/pathEdit/anchorFields.ts
packages/path-tools/src/pathEdit/anchorHandles.tsx
packages/path-tools/src/pathEdit/anchorJoin.ts
packages/path-tools/src/pathEdit/anchorNudge.ts
packages/path-tools/src/pathEdit/anchorsTool.ts
packages/path-tools/src/pathEdit/bendSegment.ts
packages/path-tools/src/pathEdit/editAnchors/editAnchors.ts
packages/path-tools/src/pathEdit/editAnchors/extensionDrags.ts
packages/path-tools/src/pathEdit/editAnchors/handleDrag.ts
packages/path-tools/src/pathEdit/editAnchors/handles.ts
packages/path-tools/src/pathEdit/editAnchors/preview.ts
packages/path-tools/src/pathEdit/editAnchors/symmetry.ts
packages/path-tools/src/pathEdit/enterPathEdit.ts
packages/path-tools/src/pathEdit/insertPathAnchor.ts
packages/path-tools/src/pathEdit/leavePathEdit.ts
packages/path-tools/src/pathEdit/pathEditMarks.ts

<!-- done: 5 findings, files read: 18 -->
