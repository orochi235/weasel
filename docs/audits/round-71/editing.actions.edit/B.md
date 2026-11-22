# Audit round 71 — editing.actions.edit (blind reviewer)

## selectAll selects a group together with every one of its descendants
- where: packages/editing/src/actions/edit/selectAll.ts:29 (selectAllAction.invoker.run)
- scenario: with nothing entered, a scene holding group `box` with child `kid` (both unlocked, visible). `scene.renderOrderNodes()` is a full DFS (every node, children included), and `reachableInGroup(scene, null, id)` answers true for any node no consumer holds, so Cmd+A sets the selection to `['box', 'kid', …]` — a container and its own member at once. Picking selects the group alone; select-all should hand back the reachable tops (the direct children of the entered group, or the roots/page content with nothing entered), not every level of the tree. Every operand-reading action then sees members twice over (`setFill`/`setStroke` write each descendant individually, rather than the group's members staying as they were; selection chrome draws a box per member). No test covers an unlocked group with a child (selectAll.test.ts only checks the hidden/locked-container cases).
- evidence: read (selectAll.ts, `reachableInGroup` in packages/core/src/canvas/deps/enteredGroup.ts:34, renderOrder's DFS contract in renderOrder.test.ts)
- severity: medium

## setVertexColor writes channels outside 0..1 unclamped
- where: packages/editing/src/actions/edit/setVertexColor.ts:15 (rgbaOf) / :45 (merge)
- scenario: `params.rgba = [2, -1, 0, 5]` passes `rgbaOf` (four finite numbers) and is spliced verbatim into `data.vertexColors`, though the doc states each channel is 0..1. The sibling opacity actions clamp (`paintWithAlpha` clamps `alpha01` to 0..1), so the same out-of-range input is answered two ways; here an out-of-range alpha or color lands in the document and is whatever the renderer makes of it.
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

<!-- done: 2 findings, files read: 14 -->
