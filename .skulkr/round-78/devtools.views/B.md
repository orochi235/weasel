# Audit round 78: devtools.views

## TraceTable and HistoryTable keep their expanded row ids across a follower reset, so a new follower's row with the same seq opens on its own
- where: packages/devtools/src/views/TraceTable.tsx:63 (TraceTable `expanded` state); packages/devtools/src/views/HistoryTable.tsx:58 (HistoryTable `expanded` state); reset sites packages/devtools/src/views/DispatchView.tsx:41 and packages/devtools/src/views/HistoryView.tsx:34
- scenario: DispatchView and HistoryView swap in a new follower when `client` changes (the view is keyed only by `rootId`, `DevtoolsPanel.tsx:70`) and clear their entries, because the new follower reads the ring from 0 again. The tables underneath are not remounted, and their `expanded` sets keep the old row ids. Row ids are `String(seq)`, and the new follower's seqs start at 0 again. Expand row `"7"`, reconnect the client, and when the new follower delivers its record 7, that row opens by itself and shows an unrelated dispatch or history step. The reset should clear the expanded sets too, for example by keying the table by follower.
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

<!-- done: 1 findings, files read: 40 -->
