## A canceled anchor drag leaves the press's selection change in place, where a canceled marquee puts the selection back
- where: packages/path-tools/src/pathEdit/editAnchors/editAnchors.ts:321 (editAnchorsAction.start / onEnd)
- scenario: anchors {1,2} are selected. The user Shift-presses anchor 5, drags, then presses Escape. `draggedByPress` has already called `setSelectedAnchors({1,2,5})` at the press. `onEnd('cancel')` returns without restoring it, so the selection stays {1,2,5}. A plain press on an unselected anchor followed by a cancel leaves the selection collapsed to that one anchor in the same way. `areaSelectAnchorsAction.onEnd` (anchorEditing.ts:308-313) restores `base` and `baseMark` on cancel. So the two drags answer "what does cancel leave selected" differently: one shows the selection as it was before the gesture, the other doesn't.
- evidence: read
- severity: low

## A segment bend dragged back to its press point still commits, unlike an anchor drag that ends where it started
- where: packages/path-tools/src/pathEdit/bendSegment.ts:69 (bendSegmentAction onEnd)
- scenario: the user presses a straight segment, drags past the threshold, then returns the pointer to exactly the press point and releases. `bendSegment(set, hit, 0, 0)` returns true and gives the segment handles at 1/3 and 2/3, so `current` is non-null and `applyEdit` records a "Bend segment" history entry for a path that looks the same. The segment's kind has also changed from straight to curve. `editAnchorsAction.onEnd` (editAnchors.ts:383) skips the commit when `samePolygon(frame, originPose)`, so the two drags handle a no-op drag differently.
- evidence: read (bendSegment in packages/geom/src/paths/bendSegment.ts always returns true)
- severity: low

## Typing an anchor's X or Y ignores the path's symmetry, while nudging and dragging the same anchor keep it
- where: packages/path-tools/src/pathEdit/anchorFields.ts:28 (fieldEdit)
- scenario: a `pathSymmetry` dep names a mirror under which the edited path is its own image. Arrow-nudging an anchor (anchorNudge.ts:62, `translateAnchorsSymmetric` with `editedPathSymmetries`) or dragging it (editAnchors.ts:207) also moves its mirror partner. Committing a number field (`setAnchorField`, x/y or handle fields) goes through `writeAnchorField`, which moves only the selected anchor, so the symmetry breaks. The action does not declare `pathSymmetry` in `requires` either. So one decision, whether an anchor edit carries its symmetric images, gets two answers depending on the input method.
- evidence: read
- severity: medium

## Double-clicking an unselected, non-editable body opens path edit on a different, selected path
- where: packages/path-tools/src/pathEdit/enterPathEdit.ts:26-36 (pathEditTarget)
- scenario: path A is selected. The user double-clicks an unselected body B that has no editable path (an image or a rect without a polygon). `under` = B fails `getEditablePath`, so the loop falls back to the selection and returns A. Path edit opens on A, a node the double-click was not aimed at, and the double-click is not left to B's own handlers. The fallback should apply only when the pointer is over no node, or over a selected one. The comment on line 25 says "the path under the pointer wins". The code also lets a node other than the one under the pointer win.
- evidence: read (inference about which handlers B would otherwise reach)
- severity: low

## leavePathEdit is always enabled, so without a mode registry it can take Escape even when no path is open
- where: packages/path-tools/src/pathEdit/leavePathEdit.ts:28 (enabled)
- scenario: a consumer with no mode registry skips the `eligible: { mode: 'path-edit' }` filter (anchorEditing.ts:15-20 describes this case). With no path open and nothing selected, `deselect` reports itself not applicable so that Escape "falls through to `tool.resetToDefault`" (editing/src/actions/edit/deselect.ts:37-38). If `leavePathEdit` ranks ahead of it, its `enabled: () => true` accepts the press and its `run` does nothing, so Escape never resets the tool. The anchor actions avoid exactly this by reporting disabled when no path is open. This action does not.
- evidence: read (which of the two ranks first depends on registration order, not checked)
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
