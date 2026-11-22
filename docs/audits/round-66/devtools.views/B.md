# Audit round 66 — devtools.views

## StateView and FrameView poll `get-state` by bumping the query's version, so a read slower than the poll interval is always discarded and never shown
- where: packages/devtools/src/views/StateView.tsx:23 (StateView), packages/devtools/src/views/FrameView.tsx:42 (FrameView)
- scenario: `usePoll(state.refresh, 500, true)` bumps `useRootQuery`'s `version` every 500 ms; each bump reruns the read effect, whose cleanup marks the previous request not live. On a page whose `get-state` answer takes ≥ 500 ms (a busy main thread, a heavy probe, a slow bridge), every answer arrives after its successor was sent and is dropped: StateView shows "Loading…" forever and FrameView's fps switch stays disabled, while a fresh request goes out every tick regardless of how many are unanswered. DispatchView and HistoryView avoid this with `coalesced`; these two should not start a read while one is outstanding, or should keep the latest answer that arrives.
- evidence: read (StateView.tsx, FrameView.tsx, hooks.ts `useRootQuery`/`usePoll`)
- severity: medium

## The scene tree keeps expanded ids of deleted nodes and re-requests their children on every scene change
- where: packages/devtools/src/views/useSceneTree.ts:52-58 (useSceneTree, onChanged handler)
- scenario: expand group `g`, then delete it on the canvas. The scene notice reloads every id in `expanded`, including `g`; `get-children` for `g` fails, the level is deleted, but `g` stays in `expanded`. Every later scene notice (each frame of a drag) sends another failing `get-children` for `g` and for every other deleted-but-once-expanded id, so the set and the per-notice request count only grow for the life of the tab; and a node later created with a reused id appears already expanded. The error path should drop the id from `expanded` (or prune `expanded` to ids present in the loaded levels).
- evidence: read
- severity: low

## The coord table drops the canvas rect, so a client point cannot be reconciled with the world point it shows
- where: packages/devtools/src/views/CoordTable.tsx:13-20 (CoordEntry), :29-47 (columns)
- scenario: the page records each conversion with `rect` (`packages/core/src/canvas/SceneCanvas/coordTrace.ts:11,36`), whose stated purpose is "so a cursor position can be reconciled with the world point it became". `CoordEntry` omits `rect` and no column shows it, so with the canvas not at the page's origin, Client, Offset and Scale do not determine World and the table cannot answer the question it exists for (e.g. client 300,200 → world 40,10 is unexplainable without the 250,180 rect origin). The `fallback` field is likewise declared and never read; the table infers fallback from `view === null` instead.
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
