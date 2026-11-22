# Audit round 70 — editing.actions.edit

## Group is enabled and runs over a locked member, whose reparent and setPose the scene's lock guard refuses
- where: packages/editing/src/actions/edit/group.ts:13 (groupPlan), :114 (groupAction.enabled), :76 (run)
- scenario: select an unlocked node and a locked node on the same layer (via the Layers panel or `operands.set`)
  and press Cmd+G. `groupPlan` never asks `scene.isLocked`, so `enabled` answers `true` and `run` commits an
  insert plus `reparent`/`setPose` on the locked node. `lockedWrites.ts` notes the scene's lock guard refuses
  those writes, and unruled.md:411-413 records the same shape of commit throwing from the scene partway through.
  Ungroup, Delete, Cut and reorder are disabled with `ActionDisabledReason.Locked` in this case (unruled.md:388-390,
  411), and `ungroupPlan` computes `locked`. Group should do the same (`opsAnswer`/`writesLocked` over its ops).
- evidence: read
- severity: medium

## Paint actions write `setData` to locked operands with no lock check, through either the selection or explicit `ids`
- where: packages/editing/src/actions/edit/createPaintAction.ts:165-175 (onEnd), :183-189 (enabled)
- scenario: `setFill` with `params.ids` naming a locked node, or with a selection that holds one. `enabled` never
  reads `isLocked`, and `onEnd` pushes a `setData` for every target and commits them as one batch. The scene's lock
  guard refuses the locked node's write (see `lockedWrites.ts`), so the whole commit throws or fails partway, and
  the unlocked targets lose their change too. The editing actions near this one (nudge through `writesLocked`,
  ungroup through `plan.locked`) either skip locked nodes or disable themselves. This action should skip locked
  targets, or answer `Locked`.
- evidence: read
- severity: medium

## Nudge's `run` moves the raw selection, but its `enabled` and `recordTransform` use the selection without page structure
- where: packages/editing/src/actions/edit/nudge.ts:26 (translateSelection), :57-58 (run) vs :68 (enabled)
- scenario: a selection that holds a page and a shape. `enabled` builds its ops from `operandContent(deps)`, which
  drops the page, while `run` calls `translateSelection` and passes `selection.get()` raw to `moveNodesOps`, which
  has no page-structure filter, so the arrow key moves the page along with the shape. `recordTransform` then
  records only `operandContent`. The two paths answer which ids move in different ways, so `enabled`'s answer is
  not the commit `run` makes. A selection holding only a page plus a locked node shows the same split.
- evidence: read
- severity: medium

## Duplicate and Group take the raw selection, page structure included, though `enabled` counts only content
- where: packages/editing/src/actions/edit/duplicate.ts:38 (duplicateSelection); packages/editing/src/actions/edit/group.ts:16 (groupPlan)
- scenario: select a page and a shape, then press Cmd+Shift+D. `requiresContent(1)` passes on the shape, and
  `duplicateSelection` hands `selection.get()`, page included, to `copyOps`/`copiedRoots`, which filter nothing
  (`rootsAmong` plus a sort), so the page and its whole subtree are copied. Group has the same split:
  `rootsAmong(scene, deps.operands.get())` takes the page as a root and reparents it under a new group. Ungroup and
  the paint actions use `operandContent`, so the shared operand question gets two answers in this area.
- evidence: read
- severity: medium

## A paint write that resolves to the inherited paint still detaches an `'inherit'` node, against the spec's "equal to prev leaves the node out"
- where: packages/editing/src/actions/edit/createPaintAction.ts:94-95 (refreshPreviews), :167-170 (onEnd)
- scenario: a node's `fill: 'inherit'` resolves to the parent's `{ paint: P }`. Running `setFill` with `paint: P`
  makes `merge(base, state)` return a value equal to `base`. The spec says that leaves the node out
  (`PaintActionSpec.merge` doc, lines 33-37). But `unchanged` compares against the raw start value `'inherit'`, not
  against `bases.get(id)`, so the node is previewed and committed. It stops inheriting, and the run leaves an undo
  entry for a write the user cannot see. The comparison should use the base the merge started from.
- evidence: read
- severity: low

## setStrokeWidth with no usable width gives every strokeless operand a default stroke
- where: packages/editing/src/actions/edit/setStrokeWidth.ts:36-53 (initialState / merge)
- scenario: invoke `setStrokeWidth` with `width: -1`, `NaN`, or no params (a trigger or a toolbar button before any
  move). `widthOf` drops the value, so the state is `{}`. On a node with no stroke, `merge` still returns
  `solidStroke(DEFAULT_STROKE_COLOR)`, and onEnd commits it, so the node gains a visible stroke from a call that set
  no width. With nothing to write, `merge` should hand back `prev`.
- evidence: read
- severity: low

## setFill / setStroke "None" on a node with no paint record writes `{}` and makes an undo entry
- where: packages/editing/src/actions/edit/setFill.ts:19-23 (repaint); packages/editing/src/actions/edit/setStroke.ts:19-23
- scenario: `setFill` with `paint: null` on a node whose `fill` is undefined. `repaint` returns `{}`, and `unchanged`
  (`deepEqual(undefined, {})`) is false, so a `setData` writing `fill: {}` is committed: an undo entry for nothing.
  unruled.md:410 says a run that writes what each node already wears commits no undo entry.
- evidence: read
- severity: low

## Files read
packages/editing/src/actions/edit/createPaintAction.ts
packages/editing/src/actions/edit/deselect.ts
packages/editing/src/actions/edit/duplicate.ts
packages/editing/src/actions/edit/group.ts
packages/editing/src/actions/edit/ingest.ts
packages/editing/src/actions/edit/nudge.ts
packages/editing/src/actions/edit/paintActionTestUtils.ts
packages/editing/src/actions/edit/selectAll.ts
packages/editing/src/actions/edit/setFill.ts
packages/editing/src/actions/edit/setFillOpacity.ts
packages/editing/src/actions/edit/setStroke.ts
packages/editing/src/actions/edit/setStrokeOpacity.ts
packages/editing/src/actions/edit/setStrokeWidth.ts
packages/editing/src/actions/edit/setVertexColor.ts

<!-- done: 7 findings, files read: 14 -->
