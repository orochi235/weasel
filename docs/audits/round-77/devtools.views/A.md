# Audit round 77 — devtools.views

## Turning coords off leaves an in-flight read free to refill the coord list, so stale coords reappear when it is turned back on
- where: packages/devtools/src/views/DispatchView.tsx:59-62 (DispatchView effect `once`) and :70-74 (toggleCoords)
- scenario: a read asked while coords were on is still out when the user flips the switch off; `toggleCoords(false)` clears `coords`, then the read resolves with `slice.coords` non-empty and `setCoords((prev) => [...prev, ...read])` appends them regardless of the switch. Turning coords back on then shows those old conversions (older seqs, ages from before the off period) ahead of the new ones, where the list should start empty. The append should check that coords are still on, e.g. through a ref or the follower's state.
- evidence: read
- severity: low

## A predicted, handled record with no `fired` reads "handled" in the trace row but "would handle" in its decision path
- where: packages/devtools/src/views/TraceTable.tsx:60-62 (renderOutcome)
- scenario: the live row (`predicted: true`, `outcome: 'handled'`, `fired: null`) shows the Outcome cell as `handled`. The unhandled branch beside it does check `predicted` ("would not handle"), and `DecisionPath` shows `would handle` for the same record. The same question gets two answers, and the trace row presents a prediction as something that happened.
- evidence: read
- severity: low

## `defaultOpen` opens a grouped category but never its group, so the category stays hidden under a closed parent
- where: packages/devtools/src/views/RegistryBrowser.tsx:112-114 (RegistryBrowser initial `openIds`)
- scenario: a host passes categories with `group: { id: 'g' }` and `defaultOpen={['tools']}`. Only `cat:tools` goes into `openIds`; `group:g` does not. At mount the group branch is collapsed, and the category "open at mount" can't be seen until the user opens the group. The selection path (lines 117-123) does add the group key, so the two ways of opening a category disagree.
- evidence: read
- severity: low

## Files read
packages/devtools/src/views/Bindings.tsx
packages/devtools/src/views/CoordTable.tsx
packages/devtools/src/views/DecisionPath.tsx
packages/devtools/src/views/DispatchView.module.css
packages/devtools/src/views/DispatchView.tsx
packages/devtools/src/views/FallthroughDiagram.fixtures.ts
packages/devtools/src/views/FallthroughDiagram.module.css
packages/devtools/src/views/FallthroughDiagram.stories.tsx
packages/devtools/src/views/FallthroughDiagram.tsx
packages/devtools/src/views/FrameView.module.css
packages/devtools/src/views/FrameView.tsx
packages/devtools/src/views/GestureRoute.module.css
packages/devtools/src/views/GestureRoute.stories.module.css
packages/devtools/src/views/GestureRoute.stories.tsx
packages/devtools/src/views/GestureRoute.tsx
packages/devtools/src/views/HistoryTable.tsx
packages/devtools/src/views/HistoryView.module.css
packages/devtools/src/views/HistoryView.tsx
packages/devtools/src/views/NodeDetail.tsx
packages/devtools/src/views/RegistryBrowser.browser.module.css
packages/devtools/src/views/RegistryBrowser.module.css
packages/devtools/src/views/RegistryBrowser.tsx
packages/devtools/src/views/RegistryEntryDetail.tsx
packages/devtools/src/views/RegistryView.module.css
packages/devtools/src/views/RegistryView.tsx
packages/devtools/src/views/SceneView.module.css
packages/devtools/src/views/SceneView.tsx
packages/devtools/src/views/StateView.module.css
packages/devtools/src/views/StateView.tsx
packages/devtools/src/views/TraceTable.module.css
packages/devtools/src/views/TraceTable.tsx
packages/devtools/src/views/ValueView.module.css
packages/devtools/src/views/ValueView.tsx
packages/devtools/src/views/coalesced.ts
packages/devtools/src/views/formatAge.ts
packages/devtools/src/views/keyName.ts
packages/devtools/src/views/modLegends.ts
packages/devtools/src/views/note.module.css
packages/devtools/src/views/sequenced.ts
packages/devtools/src/views/useSceneTree.ts

<!-- done: 3 findings, files read: 40 -->
