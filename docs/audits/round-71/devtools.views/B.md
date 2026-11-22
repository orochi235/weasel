# Audit round 71: devtools.views (reviewer findings)

## DispatchView and HistoryView keep their records and toggles across a follower change, so the new follower re-delivers the ring as duplicate rows
- where: packages/devtools/src/views/DispatchView.tsx:29-61 (DispatchView); packages/devtools/src/views/HistoryView.tsx:25-51 (HistoryView)
- scenario: `follower` is memoized on `[client, rootId]`. The panel keys each view by `rootId` only (`DevtoolsPanel.tsx:70`), so when `client` changes (a host hands `DevtoolsPanel` a new transport, which makes `useDevtoolsClient` mint a new client), the view stays mounted. The new `followTrace`/`followHistory` starts at cursor 0, and its first read returns every record the page's ring still holds, with the same `seq` numbers the old follower already delivered. `setEntries((prev) => [...prev, ...read])` appends them, so every row appears twice under the same React key (`String(seq)`), and expansion state attaches to the wrong row. `showCoords`/`showStack` also stay on while the new follower has `setCoords`/`setHistoryEntries` off, so the coords table reads "No conversions recorded yet." and the stack never fills until the switch is flipped twice. The views should reset `entries`/`coords`/`steps` and re-apply the toggles to the new follower when it changes, or the panel should key them by client as well.
- evidence: read
- severity: medium

## The Ops count and Entries list for a large history step are silently cut at 50 entries, with no sign of the cut
- where: packages/devtools/src/views/HistoryTable.tsx:21 (opCount), :57 (Entries column), :30-38 (StepDetail)
- scenario: `recordOf` (`page/history.ts:22-26`) keeps at most 50 entries per step and at most 50 ops per entry. A step that touches 80 entries (say, a jump across the undo stack, or a large batch) arrives with 50 of them. The Ops column sums `opCount` over only those 50, so it reports a smaller total than the step really had. The Entries column lists 50 names with no "…" marker. In the detail, an entry's heading says "120 ops" above a list of 50 with nothing marking the rest as cut. The record carries no total entry count, so the table can't say the step was truncated. The total, or a cut marker, should cross the wire and be shown, the way ValueView shows a `more` tag.
- evidence: read
- severity: low

## The modifier chord is ordered one way in a route strip and another way in the diagram's input line
- where: packages/devtools/src/views/FallthroughDiagram.tsx:39-42 (MOD_ORDER, InputLine); packages/devtools/src/views/GestureRoute.tsx:18 (MOD_DISPLAY_ORDER)
- scenario: The same diagram draws both the input's held modifiers (`InputLine`) and each candidate's route (`GestureRoute`). These use two separate order constants: `['shift','alt','ctrl','meta']` and `['mod','shift','alt','ctrl','meta']`. On macOS, where `mod` is ⌘, a press of ⌘⇧ shows as ⇧⌘ in the Input row and as `+⌘+⇧` in the route it matched (`+mod +shift`). One decision gets two answers in one view. One shared order should serve both, with `mod` placed where its platform key sits.
- evidence: read
- severity: low

## RegistryBrowser's narrow layout depends on a container that only DevtoolsPanel declares
- where: packages/devtools/src/views/RegistryBrowser.module.css:25-35 (`@container (width < 480px)`)
- scenario: `RegistryBrowser` is exported (`packages/devtools/src/index.ts`) and used outside the panel by `apps/draw/src/dev/RegistryInspector.tsx`. Its stacked layout for narrow widths is a container query with no `container-type` on the component itself. The only `container-type` in devtools is `DevtoolsPanel.module.css:14`, and none exists under `apps/draw/src/dev`. Mounted anywhere but inside `DevtoolsPanel`, the query never matches, so in a narrow host the two panes stay side by side at 2fr/3fr instead of stacking. `.split` should declare its own container, or the rule should be a media query.
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

<!-- done: 4 findings, files read: 38 -->
