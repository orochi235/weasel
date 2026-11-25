## A grouped category's parent branch badges how many categories it holds, not how many entries, so a filter's matches under a group go uncounted there
- where: packages/devtools/src/views/RegistryBrowser.tsx:96 (counted)
- scenario: a host passes two categories sharing `group: { id: 'g' }` with 12 and 30 entries; the group branch's badge reads `2`, beside category badges reading `12` and `30`. Filtering down to 3 matches in one category still shows `1` on the group. The doc says each branch is badged "so a filtered category counts what the filter left", but a group's badge counts its direct children (categories), a different unit from every other badge in the same column.
- evidence: read
- severity: low

## The live row's expanded state outlives the live record, so it reopens on its own when a prediction returns
- where: packages/devtools/src/views/TraceTable.tsx:67 (TraceTable), :104 (onRowClick)
- scenario: open the pinned `live` row, then move the pointer off the canvas so `live` becomes null and the row disappears; `expanded` still holds `'live'`. When the pointer comes back and a new prediction arrives, the live row renders already expanded, showing a diagram the user never opened for this record. Expanded ids of rows that are gone are never pruned.
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

<!-- done: 2 findings, files read: 40 -->
