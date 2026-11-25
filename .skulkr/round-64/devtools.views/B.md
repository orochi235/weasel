# Audit round 64 — devtools.views (blind reviewer)

Note: the brief names frozen commit 49e5a07e6aecc7037a5e3692706cf28dd58211c4, which this repository does not have
(`git cat-file` reports a bad object). Read at HEAD 6f634fabe1, which has no local changes under `packages/devtools`.

## CoordTable shows only the view's horizontal scale, so a non-uniform view's conversion cannot be read
- where: packages/devtools/src/views/CoordTable.tsx:38 (CoordTable, `scale` column)
- scenario: a canvas whose view scales x and y differently (`view.scale = { x: 2, y: 0.5 }`, as a chart's stretched
  axis does) records `view: { scaleX: 2, scaleY: 0.5, x, y }`. The Scale column prints `2.000` and nothing else, and
  the view's offset (`view.x`, `view.y`) is not shown either, though the file's header says each row shows "the camera
  it was read under". A world y that is wrong by the y scale looks unexplained. It should show both scales (and the
  offset), or one value only when they are equal.
- evidence: read (`CoordEntry.view` carries `scaleY`, written by `traceConversion` in
  packages/core/src/canvas/SceneCanvas/coordTrace.ts:37; no column reads it)
- severity: low

## FrameView keeps the last frame across an fps off/on toggle and shows it as the current paint
- where: packages/devtools/src/views/FrameView.tsx:35-39,50 (FrameView)
- scenario: turn the fps overlay on, let a frame be measured, turn it off, change the scene a lot, turn it back on.
  `frame` was never cleared when `fps` went false, so the table at once shows the old figures as "what the last
  paint cost" until a new `get-frame` answer arrives. Because `get-frame` rejections are swallowed (`() => {}`), a
  page that keeps rejecting leaves the old figures up for good. Clearing `frame` when `fps` turns off (or on) would
  show "No paint measured yet." instead.
- evidence: read
- severity: low

## FrameView drops a get-state error and shows the "fps overlay is off" note in its place
- where: packages/devtools/src/views/FrameView.tsx:33-49 (FrameView)
- scenario: a root whose `get-state` rejects (scene not mounted yet, root gone mid-session). `state.error` is set but
  never read: the switch is disabled (`!state.data`), and the tab says "The canvas measures its paints only while the
  fps overlay is on.", which is false as a reason. The State, Registry and Scene tabs answer the same failure by
  showing the error (`if (state.error) return <p>…`), so the two tabs answer one question two ways.
- evidence: read
- severity: low

## Dispatch tab's Clear leaves the coord table full, and is disabled when only coord rows exist
- where: packages/devtools/src/views/DispatchView.tsx:89-91 (DispatchView, Clear button)
- scenario: switch `coords` on, move over the canvas (coord rows fill), then press Clear: only `entries` is emptied,
  so the Coords table keeps every row. With the trace empty but coords present, Clear is disabled
  (`entries.length === 0`), so there is no way to clear the coord rows short of toggling the switch off and on, which
  also replays every coord record the canvas still holds. Clear should empty `coords` too (and enable on either).
- evidence: read
- severity: low

## The ranked and matched tables show a blank Route for a binding with no route form, where Bindings shows its spec
- where: packages/devtools/src/views/FallthroughDiagram.tsx:82-88 (Routes)
- scenario: a binding whose spec `routesForSpec` cannot express returns `routes: []`
  (packages/routing/src/interactions/dispatcher/buildDispatchRecord.ts:25). The Registry tab's `Bindings` handles
  that case by drawing the spec (`b.routes.length > 0 ? … : <ValueView value={b.spec} …/>`, Bindings.tsx:21-23); the
  Dispatch tab's Matched, Claim, Eligibility and Ranked tables render an empty cell for the same binding, so the row
  gives no hint which gesture matched. A placeholder (or the spec, if the record carried it) is missing.
- evidence: read
- severity: low

## Each trace notice queues one more serial read, so reads can back up behind a slow transport
- where: packages/devtools/src/views/DispatchView.tsx:59,62 (DispatchView effect); same shape in
  packages/devtools/src/views/HistoryView.tsx:46
- scenario: notices are flushed once per animation frame (page/notices.ts), so continuous pointer movement sends a
  `trace` notice about 60 times a second, and the 250 ms poll adds four more. Every one calls `read()`, which
  `followTrace` chains after the previous read (trace.ts:48-51) with nothing coalescing calls already queued. Over a
  transport whose round trip exceeds a frame (an extension's messaging across processes), the chain grows for as long
  as input continues and the panel falls further behind the canvas, each extra read returning nothing new. A read
  requested while one is queued should fold into it.
- evidence: read for the queueing; the backlog is inference about transport latency, not measured
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
packages/devtools/src/views/formatAge.ts
packages/devtools/src/views/keyName.ts
packages/devtools/src/views/note.module.css
packages/devtools/src/views/sequenced.ts
packages/devtools/src/views/useSceneTree.ts

<!-- done: 6 findings, files read: 37 -->
