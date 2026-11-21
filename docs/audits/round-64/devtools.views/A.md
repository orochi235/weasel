I couldn't write `.skulkr/out/findings.md` (permission was denied), so the whole document is below.

# Audit round 64: devtools.views (blind reviewer)

The brief names the frozen commit 49e5a07e6aecc7037a5e3692706cf28dd58211c4, but that commit is not in this clone (`git cat-file` reports a bad object). I read the tree at HEAD 6f634fabe1 instead. `packages/devtools/src/views` has no local changes there.

## The Scene tab recurses forever when a node is moved under one of its own children while that child's level is out of date
- where: packages/devtools/src/views/SceneView.tsx:28 (toNodes); packages/devtools/src/views/useSceneTree.ts:53 (reload on scene change)
- scenario: Start with the tree `root → B → {A, X}`, where B and A are both groups.
  1. Expand B, then A, so both levels load. Then collapse B.
  2. `levels` still holds B's level `{A, X}`, because collapsing never drops it, and `expanded` still holds A.
  3. The page moves A to the top level and then B into A, giving `root → A → B → X`.
  4. The scene notice reloads only the top level and the expanded ids: the top level is `{A}` and A's level is `{B}`, with B now a group with `childCount > 0`.
  5. B's level is not reloaded and still lists A as a group with children.
  6. `toNodes` builds every loaded level whether or not it is expanded, so it walks A → B → A → … until the stack overflows. The throw happens during render and takes the tab down.

  Even without a cycle, the same stale level makes a moved node appear in two branches under one id. Expected: a scene change drops or reloads every loaded level, not only the expanded ones, or `toNodes` only descends into expanded ids.
- evidence: read
- severity: medium

## The trace views read serialized records as raw `DispatchRecord`s, so expanding a record over the serializer's 100-item cap crashes
- where: packages/devtools/src/views/DispatchView.tsx:47 (`as unknown as TraceLogEntry[]`); packages/devtools/src/views/FallthroughDiagram.tsx:84 (Routes), :114 (MatchedStage), :187 (RankedStage)
- scenario: `traceSlice` serializes each record with `serialize(e, { depth: 12 })`, which keeps the default `items: 100`. An array longer than 100 arrives with a `{ $type: 'more', count }` element at its end. Take a dispatch whose `matched` or `ranked` list holds more than 100 candidates, as in an app with many bindings on one gesture. Its last "candidate" reaches the panel with no `routes`, `actionId` or `specificity`. Expanding that row runs `candidate.routes.map` or `c.specificity.join` on `undefined` and throws during render. The Matched column also shows 101 instead of the real count. Expected: the views skip the `more` tag or name it, as `ValueView` does, or trace records are serialized with no item cap.
- evidence: read (packages/devtools/src/page/handlers.ts:83–95, packages/devtools/src/page/serialize.ts:147,178)
- severity: low

## The Frame tab throws on a canvas with more than 100 render layers
- where: packages/devtools/src/views/FrameView.tsx:58 (layers DataGrid), :28 (`ms(r.ms)`)
- scenario: `get-frame` returns `serialize(root.source.frame())` with the default 100-item cap. With 101 or more layers, `frame.layers` ends in `{ $type: 'more', count }`. `isFrameStats` only checks that `layers` is an array, so the tag is rendered as a layer row. Its `id` is undefined (the DataGrid key), and `ms(undefined)` calls `toFixed` on `undefined`, which throws a TypeError during render. Expected: the tag is dropped or shown as "… N more", not rendered as a layer.
- evidence: read (packages/devtools/src/page/handlers.ts:111)
- severity: low

## The History tab's Age column stops counting between history notices
- where: packages/devtools/src/views/HistoryView.tsx:43 (`setNow` inside `read`)
- scenario: `now` only moves forward when a history read lands. Reads happen only on a `history` notice or when the entries switch is flipped, and nothing polls. The Dispatch tab, by contrast, polls every 250 ms and keeps its ages live. Make one edit and wait a minute: the row still says `12ms`. Every age is measured from the last edit, not from now. Expected: ages keep counting while the tab is open, as the Dispatch tab's do.
- evidence: read
- severity: low

## The coord table's Scale column drops `scaleY` and the view's offset, though the file says it shows the camera
- where: packages/devtools/src/views/CoordTable.tsx:39 (scale column)
- scenario: Each record carries `view: { x, y, scaleX, scaleY }` (from core's `traceConversion`), and the file's doc comment says the table shows "the camera it was read under". Only `scaleX` is rendered. With a non-uniform view (`scale.x ≠ scale.y`) or a pan, the table shows none of the difference. A client-to-world mismatch caused by `scaleY` or the offset then can't be worked out from the table. Expected: the row shows both scales and the offset, or the doc comment stops claiming it shows the camera.
- evidence: read (packages/core/src/canvas/SceneCanvas/coordTrace.ts:33–38)
- severity: low

## One expanded trace row names the same key three different ways
- where: packages/devtools/src/views/keyName.ts:2, used by TraceTable.tsx:36 and DecisionPath.tsx:10; FallthroughDiagram.tsx:52 (`keyLegendFromKey(…, { legend: 'text' })`); GestureRoute.tsx:65 (`keyLegendFromKey` with the default `auto` legend)
- scenario: For a keyDown of `ArrowUp` or `Escape`:
  - the row and the decision path show the raw `KeyboardEvent.key` (only space is renamed);
  - the diagram's Key field shows the platform's text legend;
  - each route strip below it shows the `auto` legend, which is a glyph on macOS.

  That makes three spellings of one key in one detail. Expected: the panel names a key in one place, and every caller goes through it.
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
packages/devtools/src/views/formatAge.ts
packages/devtools/src/views/keyName.ts
packages/devtools/src/views/note.module.css
packages/devtools/src/views/sequenced.ts
packages/devtools/src/views/useSceneTree.ts

<!-- done: 6 findings, files read: 37 -->