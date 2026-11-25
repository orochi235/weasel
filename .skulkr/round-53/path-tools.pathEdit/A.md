# Findings: path-tools.pathEdit (round 53)

## An anchor drag released where it was pressed commits an "Edit anchors" undo step that changes nothing
- where: packages/path-tools/src/pathEdit/editAnchors/editAnchors.ts:378 (editAnchorsAction onEnd)
- scenario: drag an anchor and bring it back to its press point, or drag a grid-snapped anchor a few pixels so the snap
  session pulls it back onto its own grid point (dx = dy = 0). `moveAnchors` still produces a fresh `PolygonPath` object
  through `editAnchorSetTracked` (translate by 0 returns no `false`), so `scratch.currentPose !== scratch.originPose` and
  `onEnd` calls `applyEdit`. `reshapeOps` (core `pathEditCommits.ts:111`) always emits a `setPose` op with no equality
  check, so a no-op history entry is recorded (and the edit is run through every extension's `finishEdit` and the
  data patch as a real edit). The guard compares object identity, not geometry; per the 2026-11-10 ruling an edit that
  would change nothing records no step. Same shape for a handle drag returned to its press position.
- evidence: read
- severity: medium

## Symmetry detection uses an absolute 1e-3 tolerance, so float32 rounding breaks it far from the origin
- where: packages/path-tools/src/pathEdit/editAnchors/symmetry.ts:6 (SYMMETRY_TOLERANCE / editedPathSymmetries)
- scenario: `PolygonPath.coords` is a `Float32Array`. A mirror-symmetric path drawn around x ≈ 20000 has coordinates
  whose float32 ulp is 2^-9 ≈ 0.00195, so the mirror image of one anchor and its stored partner differ by up to ~0.002
  per axis — over the 1e-3 per-axis tolerance `anchorSymmetry` checks. `editedPathSymmetries` then finds no symmetry,
  and anchor drags, handle drags and nudges under a `pathSymmetry` dep stop moving the images: the path loses its
  symmetry on the first edit. The comment says the slack is "enough to absorb a path's float32 coordinates", which only
  holds below ~8192 world units. The tolerance should scale with the coordinates' magnitude.
- evidence: read
- severity: medium

## A replacing marquee over no anchors leaves the selected extension mark selected, unlike a bare click
- where: packages/path-tools/src/pathEdit/anchorEditing.ts:286 (areaSelectAnchorsAction onMove)
- scenario: with a constraint mark selected (`dep.selectedMark` set, anchor selection empty), drag a non-additive marquee
  over empty canvas that sweeps no anchor. `onMove` calls `dep.setSelectedAnchors([])`, and the dep's
  `setSelectedAnchors` clears the mark only for a non-empty set (core `canvas/deps/editAnchors.ts:119`), so the mark
  stays selected and the next Delete deletes it. A bare click on empty canvas (`selectAnchorAction`, line 145–146)
  clears both; the two "replace the selection with nothing" paths answer differently.
- evidence: read
- severity: low

## Canceling a marquee restores the anchor selection but not the extension mark it cleared
- where: packages/path-tools/src/pathEdit/anchorEditing.ts:288-290 (areaSelectAnchorsAction onEnd)
- scenario: with a mark selected, start a marquee that sweeps an anchor (the live `setSelectedAnchors(hits)` clears the
  mark), then press Escape. `onEnd('cancel')` restores `base` (the empty anchor selection) but never restores
  `dep.selectedMark`, so the canceled gesture still deselected the mark. Cancel should leave the selection as the press
  found it.
- evidence: read
- severity: low

## insertPathAnchor selects the "inserted" index even when the commit was refused
- where: packages/path-tools/src/pathEdit/insertPathAnchor.ts:48-49 (insertPathAnchorAction run)
- scenario: Alt+click a segment of a path whose extension's `finishEdit` refuses the edit (e.g. a constraint that
  cannot be solved with the extra anchor). `applyEdit` commits nothing (core `editAnchors.ts:201-202` skips empty ops)
  and returns void, but `run` still calls `dep.setSelectedAnchors([inserted])`. On the unchanged path that index names
  the existing anchor after the segment, so an unrelated anchor becomes selected and the next nudge/delete acts on it.
- evidence: read
- severity: low

## setAnchorField stays enabled where its run does nothing
- where: packages/path-tools/src/pathEdit/anchorFields.ts:41 (setAnchorFieldAction enabled)
- scenario: `enabled` is `requiresAnchorSelection`, ignoring params. With params naming no valid field, with neither
  `to` nor `by`, with a handle field while several anchors are selected (`writeAnchorField` handles only a lone anchor),
  or with a selection an undo left naming no anchor of the path, `run` returns or commits nothing yet the action reports
  enabled. The 2026-11-10 ruling (docs/unruled.md:384) says an edit action's `enabled` asks the same question its `run`
  answers, which every sibling here does through `anchorEditWouldChange`; `enabled` receives params as its fourth
  argument (as `averageAnchorsAction` uses).
- evidence: read
- severity: low

## A Shift-press that deselects the pressed anchor still runs a snap session for a drag that moves nothing
- where: packages/path-tools/src/pathEdit/editAnchors/editAnchors.ts:352 (editAnchorsAction move)
- scenario: Shift-press an anchor that is already selected: `draggedByPress` toggles it out and returns `[]`. Each move
  still calls `snapAnchor.at`, which begins a `point` snap session on the snap dep for the pressed anchor and runs it every
  frame (drawing its snap feedback), while `moveAnchors` returns early because `dragging` is empty. The snap should not
  begin when nothing is dragged.
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

<!-- done: 7 findings, files read: 18 -->
