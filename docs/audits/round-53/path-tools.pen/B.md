# Findings: path-tools.pen (round 53)

## A join reads the other path from the raw scene node, not the world-space edit path the press was targeted against
- where: packages/path-tools/src/pen/penJoin.ts:41 (commitJoin)
- scenario: `openEndNear` finds `hit` (its `sub`, `end`, x/y) in `editAnchors.getEditablePath(id)`, which is `pathEditPathOf(shownNodeOf(sc, id), extensions)` (packages/core/src/canvas/deps/editAnchors.ts:179): world coords through the node's parent frame, and the form's edit path where a representation extension reads one. `commitJoin` instead reads `resolveEditablePathOf(scene.get(hit.id))` first, which takes the stored node with no frame (`resolveEditablePathOf` composes only the node's own pose) and no representation. For a path inside a translated/rotated/scaled group, the tail anchors come back in the group's local frame, so the joined path jumps away from where the other path was drawn. For a form-backed node (an edit path with a different anchor set), `hit.sub` and the end anchor index into a different anchor set than the one that was hit. It should read the same `edit.getEditablePath(hit.id)` that targeting and `pickUpEndpoint` use. The test harness's stand-in scene always answers `parent: null` with no pose, so this path is never exercised.
- evidence: read
- severity: high

## Double-clicking on another open path's end joins on the first click, then leaves a stray one-anchor path that the double-click will not take back
- where: packages/path-tools/src/pen/penActions.ts:92 (createPlaceAnchorAction), packages/path-tools/src/pen/penActions.ts:107 (createFinishOpenAction `enabled`), packages/path-tools/src/pen/penJoin.ts:82
- scenario: with a path in progress, double-click to finish on an open end of another path. The first click is joinable, and `commitJoin` commits and calls `resetScratch`, which clears `justClosed`. The second click lands on an empty scratch at what is now an interior anchor of the joined node, so `pickUpEndpoint` finds no end and a fresh subpath with one anchor is started, *without* `followsClose`. The double-click then reaches `pen.finishOpen`, whose `enabled` sees `anchorCount < 2` and no `followsClose`, and declines. The pen is left drawing a new path from the joint, with the rubber band following the pointer. The close path handles the same double-click by setting `justClosed` after its commit (line 83); the join commit needs the same mark.
- evidence: read
- severity: medium

## Continuing a path appends a lone one-anchor subpath that a new-path commit would drop
- where: packages/path-tools/src/pen/penCommit.ts:20-22 (commitPen) → packages/path-tools/src/pen/penContinuation.ts:31 (commitContinuation)
- scenario: with `autoCommitOnClose: false`, pick up an open path by its end, close it on its far end (it moves into `finishedSubpaths`), click once elsewhere (a new `current` with one anchor), then press Enter. `commitPen` passes `trailing` (any subpath with ≥1 anchor) to `commitContinuation`, which builds every drawn subpath and pushes `added.slice(1)` into the node, so the node gains a one-point `M` subpath that draws nothing but is stored, hit-tested and exported. The new-node branch on line 27 drops exactly this case ("One anchor draws nothing; committing it would leave an invisible node"). The two commit paths answer the same question two different ways.
- evidence: read
- severity: low

## A press on the first anchor that drifts past the drag threshold adds a duplicate anchor instead of closing
- where: packages/path-tools/src/pen/penActions.ts:139-155 (createDragHandleAction `start`)
- scenario: with ≥3 anchors, the close hint is lit (ring drawn, cursor `pointer`) and the user presses the first anchor and moves a few pixels past the drag threshold. `pen.dragHandle` runs instead of `pen.placeAnchor`. Its `start` never checks `withinCloseRadius` against `anchors[0]`, so it pushes a new anchor on top of the first, and the subpath stays open with a zero-length segment back to its start. Closing works only for a press that stays a click, though the hint drawn for the press does not depend on that. `start` should close the subpath the way the click path does (and drag the first anchor's in-handle, or at least close).
- evidence: read
- severity: medium

## Files read
packages/path-tools/src/pen/penActions.ts
packages/path-tools/src/pen/penCommit.ts
packages/path-tools/src/pen/penContinuation.ts
packages/path-tools/src/pen/penHandle.ts
packages/path-tools/src/pen/penJoin.ts
packages/path-tools/src/pen/penOptions.ts
packages/path-tools/src/pen/penPreviewLayer.ts
packages/path-tools/src/pen/penScratch.ts
packages/path-tools/src/pen/penTargets.ts
packages/path-tools/src/pen/penTrail.ts
packages/path-tools/src/pen/testing/penHarness.ts
packages/path-tools/src/pen/usePenTool.ts

<!-- done: 4 findings, files read: 12 -->
