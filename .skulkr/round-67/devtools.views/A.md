# Audit round 67: devtools.views

## A category's count badge keeps the unfiltered count while the filter hides most of its entries
- where: packages/devtools/src/views/RegistryBrowser.tsx:73 (treeOf), :93, :129 (RegistryBrowser `shown`)
- scenario: a canvas registers 40 actions; type `move` in "Filter registry". `filterTree` keeps the `Actions` branch with its two matching leaves, but the branch's `trailing` badge was built once in `treeOf` from `c.entries.length`, so it still reads `40` beside two rows (and a group's badge still counts every category, matched or not). The badge should count what the filter left, or be hidden while filtering.
- evidence: read (`filterTree` in packages/ui/src/components/Tree/treeFilter.ts pushes the original node or a copy with filtered children; it never touches `trailing`)
- severity: low

## The History tab is stuck on an error until a history notice arrives, unlike Dispatch, which retries on its poll
- where: packages/devtools/src/views/HistoryView.tsx:45, :61 (HistoryView)
- scenario: one `get-history` read rejects (a transient transport failure, or a request answered with an error). `setError` replaces the whole tab with the message — toolbar, Clear and the entries switch included — and nothing reads again until a `changed` notice naming `history` arrives; on an idle canvas that is never, so the tab shows a stale error indefinitely. DispatchView handles the same failure by polling `readNow` every 250 ms, which clears the error on the next good read. The two followers answer "what happens after a failed read" two ways; the history tab should retry (its AGE poll already runs every 250 ms) or keep a way to re-read.
- evidence: read
- severity: low

## A failed read unmounts the trace and history tables, throwing away which row was open
- where: packages/devtools/src/views/DispatchView.tsx:70, packages/devtools/src/views/HistoryView.tsx:61
- scenario: a dispatch row is expanded to its FallthroughDiagram; one poll read rejects. `if (error) return <p>…</p>` unmounts `TraceTable`, whose `expanded` state lives inside it; the next read clears the error and the table remounts with every row folded (same for `HistoryTable`). The accumulated entries survive in the parent, so only the view state is lost, but a single transient failure during inspection collapses what the user was reading. The error should render beside the tables, not instead of them.
- evidence: read
- severity: low

## An unlabeled history entry is named three different ways in one tab
- where: packages/devtools/src/views/HistoryTable.tsx:54 (Entries column), :24/:26 (StepDetail), packages/devtools/src/views/HistoryView.tsx:86 (stack list)
- scenario: a step touches an entry with an empty `label` and id `7`. The row's Entries column shows `#7`, the expanded detail's heading shows `unlabeled` (aria-label `Entry 7`), and the "History entries" stack shows bare `7`. One decision — how an unlabeled entry is named — is answered in three places, so the same entry cannot be matched across the row, its detail and the stack by eye.
- evidence: read
- severity: low

## A predicted miss in the live row reads "unhandled", as if an input had gone unhandled
- where: packages/devtools/src/views/DecisionPath.tsx:26-28 (DecisionPath)
- scenario: the live prediction (`record.predicted === true`) for a press over empty chrome has `outcome: 'unhandled'`. The handled branch distinguishes prediction (`would handle` vs `handled`), but the unhandled branch prints `unhandled` for both, so the pinned live row's path says an input was unhandled when nothing was pressed. It should read `would not handle` (or similar) when predicted, matching the handled branch.
- evidence: read
- severity: low

## Coord columns lose their alignment once a value needs more than 8 characters (≥ 1 000 000, or ≤ −100 000)
- where: packages/devtools/src/views/CoordTable.tsx:26 (fixed)
- scenario: the pad width is fixed at 8 characters, which the comment sizes for "tens of thousands, sign included". A world point at x = 123456.7 (`123456.7`, 8 chars) fits, but −123456.7 is 9 and 1234567.0 is 9, so on a canvas scrolled far from the origin rows overflow the pad and the column's decimal points stop lining up. Far-from-origin worlds are exactly where a coord trace is used to debug; the pad should come from the widest value in the shown rows.
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

<!-- done: 6 findings, files read: 25 -->
