I couldn't write `.skulk/out/findings.md` because the write was denied, so the whole document is below. One more thing: this checkout's HEAD is `782733b19c`, not the brief's `44e73a944b…`. Paths and line numbers are from the tree as checked out.

# Audit round 47 — editing.actions.edit

## Paint actions and nudge act on page structure that group, ungroup and duplicate filter out
- where: packages/editing/src/actions/edit/createPaintAction.ts:88 (start), :145 (enabled); packages/editing/src/actions/edit/nudge.ts:25 (translateSelection), :62 (enabled)
- scenario: the `operands` dep comes from a caller's own selection api (`withoutPageStructure`'s doc says one "may have filled [it] with anything") and holds a page, or a page plus content. `setFill`/`setStroke`/`setFillOpacity`/`setStrokeOpacity`/`setStrokeWidth`/`setVertexColor` take `selection.get()` raw, so they preview and commit a `setData` writing `fill`/`stroke` onto the page node. Their `enabled` checks only that operands is non-empty, so with only a page selected it reports enabled. Nudge passes the raw ids to `moveNodesOps`, which does not filter structure either, so it moves the page. For the same operands, `group` (`rootsAmong`), `ungroup` (`operandContent`) and `duplicate` (`requiresContent` / `copiedRoots`) drop pages and the page run. That gives two answers to "what does a scene action act on": these actions should go through `operandContent` / `requiresContent` like the rest.
- evidence: read
- severity: medium

## Group places the container from a parent-local pose read as a world pose when the members have no drawn bounds
- where: packages/editing/src/actions/edit/group.ts:37-40 (groupPlan)
- scenario: when `unionBounds` returns null (every member skipped, e.g. empty groups or members with no finite visual bounds), `containerWorldPose = nodes[0]!.pose`. That is the member's stored, parent-relative pose, and `frame.localUnder(parent, …)` then treats it as a world pose. Take members nested under a translated or rotated group: the container's stored pose gets that parent's transform applied a second time, so its frame sits away from the members. The members still keep their screen places because `decompose` runs against the same wrong frame, but their stored poses are expressed against that offset frame, and handles or bounds read from the container's pose land in the wrong place. The fallback should use `worlds.get(nodes[0].id)`, the member's world pose (shifted). The same applies to the `fromBounds` template on line 39, which hands over local rotation and scale fields where world ones are meant.
- evidence: read
- severity: low

## setVertexColor stays enabled where it can change nothing
- where: packages/editing/src/actions/edit/createPaintAction.ts:145 (enabled), used by packages/editing/src/actions/edit/setVertexColor.ts:18
- scenario: the selection holds only nodes without `data.vertexColors` (for example plain paths, or a stroke-vertex-colored path, whose colors live on `stroke.vertexColors`). By its own doc, `merge` leaves every such node "as it is", so any run commits nothing. `enabled` still returns `true`, because the shared paint `enabled` checks only that operands is non-empty. The 2026-11-10 ruling in docs/unruled.md says an edit action that would change nothing is disabled with `NotApplicable`, and that `enabled` asks the same question `run` answers. A panel or palette therefore offers a command that does nothing.
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

<!-- done: 3 findings, files read: 14 -->