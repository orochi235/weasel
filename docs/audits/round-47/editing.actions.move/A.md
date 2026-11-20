I couldn't write `.skulk/out/findings.md` because the write wasn't approved, so the whole document is below. I also couldn't run `git` to confirm the tree is at 44e73a9; the checkout's HEAD reads 782733b19c, and the line numbers below are from the files as they are on disk.

## A layout exit translates an envelope root's descendants by the drag in the old frame, after the root has left that frame
- where: packages/editing/src/actions/move/commit/layoutRelease.ts:142 (layoutReleaseOps)
- scenario: A layout container L whose frame sits at world (100, 0) holds a non-frame group G (an envelope with its own stored pose) holding mark c. Drag G out of L and release over empty canvas. `resolveLayoutExits` sends G to the layer root, so G gets a reparent and a setPose rebased to world (lines 114–131). Its descendant c is still in `unreleasedIds(...)`: G is selected, so the climb stops without claiming c, and the `!exits.has(id)` filter only drops G. c then goes through `translateOps`, where `localDelta` adds the drag to c's pose as stored under L's frame. G is an envelope, so after the reparent c composes under the root frame and lands 100 units left of where the drag showed it. `landedDescendantOps` skips c because the batch already writes it. `reparentOps` and `pageDropOps` handle the same case with `landedCascadeOps`, which rebases each rider into the frame it moves into. This exit path doesn't, so the same subtree lands correctly through a reparent-on-drop but not through a layout exit.
- evidence: read (layoutRelease.ts:113-147, translate.ts:39-53, commit/reparent.ts:96-122, commit/pageDrop.ts:156)
- severity: medium

## Every snapToContainer instance shares one scratch slot, so two on one binding cancel each other's dwell
- where: packages/editing/src/actions/move/behaviors/snapToContainer.ts:19 (STATE, getState)
- scenario: A binding passes `behaviors: [snapToContainer({ dwellMs: 300, findTarget: trays }), snapToContainer({ dwellMs: 800, findTarget: bins })]`. Both read and write the same `SnapState`, because `STATE` is one module-level key. On each frame the first sets `pendingTargetId` to the tray and starts its timer. The second sees a different `pendingTargetId`, calls `clearTimer` (which cancels the first's timer) and starts its own. On the next frame the first does the same to the second. Neither dwell ever completes. If one does commit, the other's `track` and `released` read that `committedSnap` as its own and plant into the other behavior's container. The comment at lines 15–18 says each call is "the only writer of its own SnapState instance", which is false. `swapOnDrop.ts:42-44,102` gives each instance its own key for exactly this reason.
- evidence: read
- severity: medium

## A scrolled source container is handed two different bounds: unscrolled while previewing, scrolled on release
- where: packages/editing/src/actions/move/layout/dropPass.ts:101 (sourceReflow)
- scenario: `sourceReflow` gives the source container's `childPoses` the bounds `boxOf(g, view.upright)`, which is the container's own box with no scroll offset. The same source container's `releaseDrop` in `layoutRelease.ts:40` gets `boxOf(g, view.toStrategy(composeChildFrame(...)))`, which is the child frame and includes the scroll offset. The destination candidate (`container.ts:111`) also uses the scroll-offset content box, and `container.ts:15-17` says that is what keeps the slots it places agreeing with its children as they are shown. Take a list container scrolled by 200 and drag one child into another container. The leftovers' reflow is computed against bounds 200 off from the frame their children are composed in. Those poses are both previewed and committed (`commit/layoutDrop.ts:61-76` writes `lp.sourceReflow`), so the remaining siblings jump by the scroll offset. Releasing the same child outside every container lays the same leftovers out against the scrolled bounds.
- evidence: read
- severity: medium

## swapOnDrop picks the swapped node from the selection, not from what the drag moves
- where: packages/editing/src/actions/move/behaviors/swapOnDrop.ts:105 (draggedOf)
- scenario: `draggedOf` reads `session.selected`, the ids before `moveSources`. Select one node D whose pose derives from A and B (a node with `derivePose` and `dependsOn`). `selected.length === 1`, so the swap arms. The drag moves A and B (`session.ids`), and `hitTarget` excludes them. On release, `swapOps(scene, D, target)` trades the derived node D, whose written pose the next read overwrites, rather than the sources the user actually dragged. A drag that moves two nodes should never swap (line 104). It does here because the check counts selected ids instead of moved ones.
- evidence: read (session.ts:128-130, core selectionSubtree.ts:37-59)
- severity: low

## Descendant carry measures each landed root with the scene's projection instead of the node's own descriptor
- where: packages/editing/src/actions/move/landedDescendants.ts:35 (landedDescendantOps); also layout/dropPass.ts:127-132 (reflowCarry) and dropPass.ts:111-112 (sourceReflow's `same` test)
- scenario: Everywhere else the move measures a node with `session.descriptorOf(id)` or `poseDescriptorForNode(session.projection, node)`, for example `delta.ts:23`, `commit/reparent.ts:107` and `layout/dragged.ts:33`. These three sites use the bare `session.projection` for every node. Take a scene where a node kind registers its own pose descriptor. When a layout drop or a reflow moves such a root, the `(dx, dy)` its envelope's descendants are carried by is read from the wrong box, so they drift from it or don't move at all. `sourceReflow` can also misjudge whether a leftover moved.
- evidence: read
- severity: low

## A layer whose plane is singular throws at press
- where: packages/editing/src/actions/move/capture.ts:101 (capturePlaneRefs)
- scenario: `toPlane(invertPlane(m)!, own)` asserts the inverse exists. A layer whose plane map collapses, for example one scaled to 0 on an axis, makes `invertPlane` return null. The press that starts a move of a node on that layer then throws inside `beginMove`, after the binding behaviors' `onStart` has run and before the session exists to cancel them. Elsewhere in this action a singular frame refuses gracefully (`localDelta` returns null, and `rebaseTransformOp` and `landedLocalPose` return null).
- evidence: read
- severity: low

## Files read
packages/editing/src/actions/move/action.ts
packages/editing/src/actions/move/behaviors/clampMove.ts
packages/editing/src/actions/move/behaviors/index.ts
packages/editing/src/actions/move/behaviors/layoutDrop.ts
packages/editing/src/actions/move/behaviors/pageDrop.ts
packages/editing/src/actions/move/behaviors/reparentOnDrop.ts
packages/editing/src/actions/move/behaviors/snapBackOrDelete.ts
packages/editing/src/actions/move/behaviors/snapToContainer.ts
packages/editing/src/actions/move/behaviors/swapOnDrop.ts
packages/editing/src/actions/move/capture.ts
packages/editing/src/actions/move/commit/index.ts
packages/editing/src/actions/move/commit/layoutDrop.ts
packages/editing/src/actions/move/commit/layoutRelease.ts
packages/editing/src/actions/move/commit/pageDrop.ts
packages/editing/src/actions/move/commit/rebase.ts
packages/editing/src/actions/move/commit/reparent.ts
packages/editing/src/actions/move/delta.ts
packages/editing/src/actions/move/dragSnap.ts
packages/editing/src/actions/move/frame.ts
packages/editing/src/actions/move/gestureAdapter.ts
packages/editing/src/actions/move/index.ts
packages/editing/src/actions/move/landedDescendants.ts
packages/editing/src/actions/move/layout/container.ts
packages/editing/src/actions/move/layout/dragged.ts
packages/editing/src/actions/move/layout/dropPass.ts
packages/editing/src/actions/move/layout/exits.ts
packages/editing/src/actions/move/layout/glide.ts
packages/editing/src/actions/move/layout/types.ts
packages/editing/src/actions/move/layout/view.ts
packages/editing/src/actions/move/refusal.ts
packages/editing/src/actions/move/session.ts
packages/editing/src/actions/move/sessionOf.ts
packages/editing/src/actions/move/translate.ts

<!-- done: 6 findings, files read: 33 -->