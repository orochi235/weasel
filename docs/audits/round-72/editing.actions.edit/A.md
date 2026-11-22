# Audit round 72 — editing.actions.edit (blind reviewer)

## setFill/setStroke start state takes `paint` from the binding over an invocation's explicit `color`
- where: packages/editing/src/actions/edit/setFill.ts:47 (initialState), packages/editing/src/actions/edit/setStroke.ts:53 (initialState), with `pick` at packages/editing/src/actions/edit/createPaintAction.ts:137
- scenario: a binding declares `params: { paint: <gradient> }` (or `paint: null`), and the invocation that starts the gesture carries `{ color: '#ff0000' }` and no `paint`. `pick` resolves each key on its own, so the state is `{ color: '#ff0000' (invocation), paint: <gradient> (binding) }`, and `repaint` writes the binding's paint because `paint` shadows `color`. The invocation's explicit color is dropped. `readParams` says the opposite for later ticks ("an explicit color supersedes a paint from an earlier tick"), so the same color/paint pair resolves differently depending on whether it arrives at start or on a move. The initial state should treat an invocation `color` as superseding a fallback `paint`, as `readParams` does.
- evidence: read (traced `pick` and `initialState`; I did not run it)
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

<!-- done: 1 findings, files read: 14 -->
