# Findings: editing.actions.move

## A root that a drop reparents skips its data-held geometry op, though the translate commit writes one
- where: packages/editing/src/actions/move/commit/reparent.ts:175 (reparentOps)
- scenario: `geometryProjection` dep wired (geometry held in `data`), reparent-on-drop on. Drag a node over a group and release. The root gets a bare `coreOps.setPose` with no geometry data op. Its riders go through `translateNodeOps`, which does emit `createGeometryDataOp`. Result: the root's pose moves but its data-held geometry stays where it was, while its descendants' geometry moves. A plain translate of the same drag (`translateOps`) updates both. The same bare setPose for a landed root is in `pageDropOps` (commit/pageDrop.ts:160), the layout exits in `layoutReleaseOps` (commit/layoutRelease.ts:150), and the descendant ops `landedDescendantOps` adds (landedDescendants.ts:49). So the commit answers the geometry question one way on the translate path and another way on every landing path. (layoutDropOps carries a TODO saying it skips this; the other paths don't.)
- evidence: read (translateNodeOps in packages/core/src/interactions/actions/moveNodes.ts:52-55 pairs each setPose with a geometry data op)
- severity: medium
- fix: packages/editing/src/actions/move/commit/reparent.ts, packages/editing/src/actions/move/commit/pageDrop.ts, packages/editing/src/actions/move/commit/layoutRelease.ts, packages/editing/src/actions/move/landedDescendants.ts
- size: function
- cause: landing paths write setPose directly instead of going through translateNodeOps / createGeometryDataOp
- confidence: likely

## Riders of a reparented root are only translated, so a drop into a turned or scaled frame keeps their old local rotation
- where: packages/editing/src/actions/move/commit/reparent.ts:105 (landedCascadeOps)
- scenario: Select an envelope group (no frame of its own) holding a child, drag it, and drop it into a group rotated 30°. The root gets the full rebased pose from `landedLocalPose`, so its stored rotation becomes −30° and it keeps its world look. Each rider gets only a translation: `to.x − from.x` between the bounds of its start pose in the old frame and its landed pose in the new one. Its stored rotation stays what it was in the old, unturned frame. Now under the turned frame, the rider renders turned by 30° relative to how the drag showed it, and apart from its root. Its landed pose `landed` is already computed and then thrown away except for its box origin.
- evidence: read
- severity: medium
- size: function
- cause: rider placed by box-origin delta across frames with different linear parts
- confidence: likely

## Transform-again records the pointer delta even when the commit was a swap, delete, slot or layout placement
- where: packages/editing/src/actions/move/action.ts:83 (onEnd)
- scenario: On every commit that lands, `recordTransform(scene, { kind: 'translate', ...frame.delta }, subject)` runs, whatever the behaviors answered. Examples: a `swapOnDrop` release (the node moves to the target's place, not by the delta); a layout drop (the node lands in a slot); a `snapBackOrDelete` delete (the subject no longer exists). After any of these, "transform again" repeats a translate by the raw drag delta on the selection. That is a move the user never made. It should record only when the default translate (or a behavior answering a pure translate) committed.
- evidence: read (recordTransform in packages/core/src/interactions/actions/transform-again/memory.ts:54)
- severity: low
- fix: packages/editing/src/actions/move/commit/index.ts
- size: function
- cause: commitMove reports only a boolean, not which path committed
- confidence: likely

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

<!-- done: 3 findings, files read: 33 -->
