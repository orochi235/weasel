## Bending a segment ignores the `pathSymmetry` dep, so it breaks a symmetric path that every other path-edit drag keeps symmetric
- where: packages/path-tools/src/pathEdit/bendSegment.ts:65 (bendSegmentAction.start → onMove)
- scenario: a path that is its own mirror image under a `pathSymmetry` transform, in path edit. An anchor drag (`translateAnchorsSymmetric`), a handle drag (`moveHandleSymmetric`) and an arrow nudge (`nudgeEdit`) all move every image of what they move. A segment bend calls plain `bendSegment(set, hit, dx, dy)` and neither requires `pathSymmetry` nor reads `editedPathSymmetries`, so only the pressed segment bends and its mirrored partner stays put: the committed path is no longer symmetric. The same question, whether an edit's images follow it, is answered two ways.
- evidence: read
- severity: medium

## An anchor drag's snap offers targets that move with the drag: symmetric images and extension-weighted followers
- where: packages/path-tools/src/pathEdit/editAnchors/editAnchors.ts:158 (anchorDragSnap.at)
- scenario: the snap's `also` path and anchors come from `pathAwayFromAnchors(originPose, press.dragging)`, which removes only the dragged anchors. Under a `pathSymmetry` mirror, `translateAnchorsSymmetric` also moves each dragged anchor's image; with an extension's `weights`, `translateWeighted` moves follower anchors. Those anchors, and the segments meeting them, stay in the snap targets at their press positions. Dragging an anchor near the mirror axis snaps it to where its own image started, a point that has already moved, so it lands at a stale spot. Only the anchors this frame leaves still should be offered.
- evidence: read
- severity: low

## Canceling an anchor drag keeps the selection its press made
- where: packages/path-tools/src/pathEdit/editAnchors/editAnchors.ts:321 (start → draggedByPress), :383 (onEnd)
- scenario: anchors 2 and 5 are selected, or an extension mark is. Pressing anchor 7 and dragging calls `dep.setSelectedAnchors({7})` in `start`, which also clears the mark through the dep. Escape cancels the drag: `onEnd('cancel')` reverts the geometry but leaves the selection at {7} and the mark gone. `areaSelectAnchorsAction`'s cancel in anchorEditing.ts:310 restores both the anchor selection and the mark it found, so a canceled gesture is undone in one action and not in the other.
- evidence: read
- severity: low

## A segment bend commits a history entry even when the frame is unchanged
- where: packages/path-tools/src/pathEdit/bendSegment.ts:73 (onEnd)
- scenario: drag a curved segment away and back to the press point before releasing. The last frame is `bendSegment` with dx = dy = 0, which gives the same polygon. `onEnd` calls `dep.applyEdit(..., 'Bend segment')` without the `samePolygon(frame, origin)` check that `editAnchorsAction.onEnd` makes (editAnchors.ts:383), so an empty "Bend segment" undo step is pushed. On a smooth anchor that is only nearly collinear, `alignedOpposite` also snaps the opposite handle, making a small edit the user never asked for.
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

<!-- done: 4 findings, files read: 18 -->
