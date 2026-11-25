# Audit round 71 — devtools.views

## Dispatch tab's KEEP cap counts hidden unhandled records, so idle pointer moves evict the handled records the default filter shows
- where: packages/devtools/src/views/DispatchView.tsx:47 (DispatchView, read effect) with packages/devtools/src/views/TraceTable.tsx:48-51 (TraceTable rows)
- scenario: the panel opens with only `handled` shown (line 35; its own comment says unhandled records are "every idle pointer move"). Each read appends every record, handled or not, then keeps the last 200 (`slice(-KEEP)`); TraceTable filters after that. Perform one handled gesture (a click with the select tool), then move the pointer over the canvas for a few seconds: the moves, all unhandled and hidden, push the handled record out of `entries`, and the table falls to "Every record is hidden by the filters above." The panel reads incrementally through a cursor, so it could keep the handled history past the canvas's ring, but the cap is applied to the unfiltered list. The cap should count what the filter keeps (or keep handled and unhandled under separate caps), so hidden rows never evict visible ones.
- evidence: read
- severity: medium

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
