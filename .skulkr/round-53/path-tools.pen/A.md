## The pen's join reads the other path from the raw scene node, not the path it hit-tested against
- where: packages/path-tools/src/pen/penJoin.ts:41 (commitJoin)
- scenario: The hit (`hit.sub`, `hit.end`, `hit.x/y`) comes from `openEndNear` → `pathsNear`, which reads `deps.editAnchors.getEditablePath(id)`. In core's dep that is `pathEditPathOf(shownNodeOf(sc, id), extensions)`: the node shown through its container's frame, and the form's edit path where a `PathRepresentation` reads the node. `commitJoin` instead takes `resolveEditablePathOf(scene.get(hit.id))` first, falling back to `getEditablePath` only when that is null. `scene.get` is the raw node, so (a) for a path inside a transformed group/frame, `other` is in the node's stored frame, not world, and the tail anchors (and, when continuing, `rest`'s subpaths) are spliced into a world-space path at the wrong place; (b) for a node drawn from a form (spiro, etc.), `other` is the drawn polygon, whose subpath/anchor numbering differs from the edit path the hit indexed, so `otherSet.anchors[hit.sub]` is the wrong anchors or undefined (throw on `tail[0]`). Should read the same `getEditablePath(hit.id)` the hit came from, as `pickUpEndpoint` does.
- evidence: read (packages/core/src/canvas/deps/editAnchors.ts:179, packages/core/src/domains/paths/nodeFrame.ts:72, packages/core/src/domains/paths/editablePath.ts:71)
- severity: high

## A double click on another path's endpoint joins, then leaves a stray one-anchor subpath in the pen
- where: packages/path-tools/src/pen/penActions.ts:89-92 (createPlaceAnchorAction run), :107 (finishOpen enabled)
- scenario: Draw two anchors, then double-click an open end of another path. Click 1 joins (`commitJoin` commits and `resetScratch`s). Click 2 runs from idle: the join point is now interior, so `pickUpEndpoint` finds nothing and a new subpath with one anchor starts. The double click's `pen.finishOpen` is disabled (`anchorCount` 1, and `followsClose` is unset because a join never sets `justClosed`), so the stray anchor stays with a live rubber band. The close path handles the same sequence via `justClosed`/`followsClose`; the join path, which also commits and ends the path, does not.
- evidence: read
- severity: medium

## A press on the first anchor that becomes a drag places a coincident anchor instead of closing
- where: packages/path-tools/src/pen/penActions.ts:139-155 (createDragHandleAction start)
- scenario: With ≥3 anchors the close hint is lit and the cursor reads `pointer` over the first anchor. A click there closes (placeAnchor's `withinCloseRadius` check), but a press that drifts past the drag threshold routes to `pen.dragHandle`, whose `start` has no close check: it appends a new anchor on top of the first (exactly on it when continuing, since `placeAt` snaps to the own subpath's far end) and leaves the subpath open with a zero-length segment. Should close the subpath (and pull the closing anchor's handle), consistent with the click path and the hint.
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

<!-- done: 3 findings, files read: 12 -->
