# Audit round 67 — devtools.views (blind reviewer)

## Route strips are keyed by route text, so a binding whose spec lists one key twice collides
- where: packages/devtools/src/views/Bindings.tsx:22 (Bindings), packages/devtools/src/views/FallthroughDiagram.tsx:87 (Routes)
- scenario: `routesForSpec` (packages/routing/src/tools/routing/reflection/registry.ts:128) maps every arg of a spec to a route string, with no dedupe. A key binding written `{ kind: 'key', key: ['Delete', 'Delete'] }`, or any arg list that formats to the same route twice, gives `routes` two equal strings. Both views render `<GestureRoute key={r} …>`, so React sees duplicate keys: it warns, and on a later re-render (the Registry tab re-reads on every scene and selection change) it can reuse or drop the wrong child. The list should be keyed by index, or by index and route, as the sibling lists in the same files already are (`key={i}`).
- evidence: read (the view code and `routesForSpec`); that a real spec lists one arg twice is inference
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
packages/devtools/src/views/note.module.css
packages/devtools/src/views/sequenced.ts
packages/devtools/src/views/useSceneTree.ts

<!-- done: 1 findings, files read: 38 -->
