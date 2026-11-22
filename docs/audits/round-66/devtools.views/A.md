# Findings: devtools.views (round 66)

## RegistryBrowser's filter field freezes when a caller passes `onFilterChange` without `filter`
- where: packages/devtools/src/views/RegistryBrowser.tsx:105-106 (RegistryBrowser)
- scenario: a host that only wants to hear about filter changes passes `onFilterChange` and leaves `filter` unset. `filter` resolves to `ownFilter` (`props.filter ?? ownFilter`), but `setFilter` resolves to the caller's callback (`props.onFilterChange ?? setOwnFilter`), so `ownFilter` never changes. The Input is controlled at `''`, so every keystroke is reported and then reverted, and the field never shows or applies a query. What should happen: control should follow whether `filter` is given, so the browser keeps its own state and also calls `onFilterChange`. The props doc ("Omit both to let the browser hold it") doesn't cover the case of passing just one, and passing only one leaves the field dead.
- evidence: read
- severity: low

## FrameView's frame poll lets a stale `get-frame` answer overwrite a newer one
- where: packages/devtools/src/views/FrameView.tsx:43-49 (FrameView, the second usePoll)
- scenario: with the fps overlay on, a request is sent every 500 ms whether or not the last one has answered (no `coalesced`, no sequence check). The only guard is `span`, which changes only when the overlay is toggled. If the page takes longer than the poll period to answer, or answers out of order, an older frame's stats arrive after a newer one and replace it, so the panel shows an older paint as the current one. A page that has stopped answering also gets one new request per tick, with nothing limiting how many are pending. The Dispatch and History tabs run their reads through `coalesced` for this reason. Expected: at most one read in flight, and only the newest answer applied.
- evidence: read
- severity: low

## HistoryTable's row click collapses the open step when the clicked step has nothing to expand
- where: packages/devtools/src/views/HistoryTable.tsx:69-72 (HistoryTable)
- scenario: `rowExpandable` says a step with `entries.length === 0` cannot open, but `onRowClick` doesn't check that and replaces the expanded set with `new Set([id])` for any row. Clicking a step with no entries while another step is open closes the open step and opens nothing. TraceTable makes the same decision consistently: its `onRowClick` returns early for rows that can't expand (`entry.kind !== 'dispatch'`). Expected: a click on a step that can't expand leaves the expanded set alone.
- evidence: read
- severity: low

## Files read
packages/devtools/src/views/Bindings.tsx
packages/devtools/src/views/CoordTable.tsx
packages/devtools/src/views/DecisionPath.tsx
packages/devtools/src/views/DispatchView.tsx
packages/devtools/src/views/FallthroughDiagram.fixtures.ts
packages/devtools/src/views/FallthroughDiagram.stories.tsx
packages/devtools/src/views/FallthroughDiagram.tsx
packages/devtools/src/views/FrameView.tsx
packages/devtools/src/views/GestureRoute.stories.tsx
packages/devtools/src/views/GestureRoute.tsx
packages/devtools/src/views/HistoryTable.tsx
packages/devtools/src/views/HistoryView.tsx
packages/devtools/src/views/NodeDetail.tsx
packages/devtools/src/views/RegistryBrowser.tsx
packages/devtools/src/views/RegistryEntryDetail.tsx
packages/devtools/src/views/RegistryView.tsx
packages/devtools/src/views/SceneView.tsx
packages/devtools/src/views/StateView.tsx
packages/devtools/src/views/TraceTable.tsx
packages/devtools/src/views/ValueView.tsx
packages/devtools/src/views/coalesced.ts
packages/devtools/src/views/formatAge.ts
packages/devtools/src/views/keyName.ts
packages/devtools/src/views/sequenced.ts
packages/devtools/src/views/useSceneTree.ts

<!-- done: 3 findings, files read: 25 -->
