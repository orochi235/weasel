The findings file couldn't be written: permission to write `.skulk/out/findings.md` was denied. As the brief says, the whole document is below.

# Audit round 45: devtools.views

The brief names the frozen commit 04c3a6536306f9e757e77a6ab15759ff43b02241, but that object isn't in this clone (`git cat-file` reports a bad object). I read the checkout at 782733b19c instead; `packages/devtools` has no uncommitted changes there.

## GestureRoute drops a hover route's `held` slot, so `hover +held` and `hover ?held` look the same as plain `hover`
- where: packages/devtools/src/views/GestureRoute.tsx:116 (modifierKeys) and :139 (gestureRouteSegments)
- scenario: `parseRoute('[*] hover +held')` returns `{ …, held: 'required' }` (gestures/src/grammar/routeGrammar.ts:205). `gestureRouteSegments` reads only `parsed.modifiers`, through `modifierKeys`, and never reads `parsed.held`. So the Registry tab's Bindings and the Dispatch tab's FallthroughDiagram draw the same strip for three different bindings: one that needs the button held, one that allows it, and one that forbids it. The docstring says the strip "shows the whole binding". It should draw `held` as its own segment, or in the chord, with the same `+`/`?` marks.
- evidence: read
- severity: medium

## A route the panel's grammar rejects throws during render and takes down the whole panel
- where: packages/devtools/src/views/GestureRoute.tsx:140 (gestureRouteSegments → parseRoute / getGestureDescriptor); reached from Bindings.tsx:23 and FallthroughDiagram.tsx:85 (Routes)
- scenario: route strings are page data. The page builds them with its own `routesForSpec` (page/registry.ts:34) and with the dispatcher's records, and the panel parses them with its own grammar. `parseRoute` throws on anything that grammar doesn't know: `unknown gesture "dblTap"`, a new sigil, a new arg value.
  - The page and panel can run different kit versions. `sup` carries `kitVersion`, and the only compatibility check is `DEVTOOLS_PROTOCOL`, which is still `1` after the `dblTap` → `doubleClick` rename (cfbecdb3fc).
  - So take a panel built after the rename, attached to a page built before it. It throws inside render as soon as the user picks an entry with a double-click binding, or opens a trace row whose candidates include one.
  - There is no error boundary anywhere in `packages/devtools/src`, so React unmounts the whole panel instead of only that strip.
  - The fix: fall back to the raw route text when `parseRoute` throws.
- evidence: read (the throw path and the missing boundary); inference (that page and panel versions differ in practice)
- severity: medium

## A dep's "Required by" lists only actions, never the tools that declare the dep
- where: packages/devtools/src/views/RegistryEntryDetail.tsx:535 (RegistryEntryDetail, deps branch)
- scenario: `users` comes only from `registry.actions[].requires`. Tools carry their own `deps` list, which ToolDetail shows at :476, but a tool that reads a dep is never named on that dep's page. A dep used only by a tool shows an empty "Required by", as though nothing used it. So the tool's page and the dep's page answer "who uses this dep" differently. The list should also include every tool whose `tool.deps` names the dep.
- evidence: read
- severity: low

## The State tab's overlays and probes go stale: the query never re-runs when they change
- where: packages/devtools/src/views/StateView.tsx:157 (StateView, useRootQuery areas)
- scenario: the query re-reads only on `selection`, `view` and `tool` notices, plus the tab's own steering.
  - Overlay flags have no `DevtoolsArea` and send no notice. A flag changed anywhere else goes unseen, such as by the Frame tab's fps switch (FrameView.tsx:362) or by the app toggling its own overlays.
  - Probes are read once per query (page/handlers.ts:64). A probe that tracks the scene, such as a node count, keeps its first value through any number of scene edits.
  - The next Overlays click diffs against the stale `st.overlays` (:197), so it can resend a flag that is already set, or skip one that isn't.
  - The fix: listen to `scene` too, or poll while the tab is open, as FrameView and DispatchView do.
- evidence: read
- severity: low

## CoordTable's padding collapses in HTML, so x and y don't line up across rows
- where: packages/devtools/src/views/CoordTable.tsx:60 (fixed, pair)
- scenario: `fixed` pads each number to 8 characters, and `pair` puts x and y in one cell separated by a space. The cell uses TraceTable.module.css's `.count`, which has no `white-space: pre` (FrameView's `.figure` does). So the browser collapses the spaces: `   12.0    -3.5` renders as `12.0 -3.5`. With right alignment, y's last digit lines up from row to row, but x's decimal point shifts with y's width. The padding has no effect.
- evidence: read
- severity: low

## CoordTable keys rows by their position in the window, so every row remounts once the window is full
- where: packages/devtools/src/views/CoordTable.tsx:64 (CoordTable rows)
- scenario: `id` is `${entry.ts}-${i}`, where `i` is the index inside `entries.slice(-100)`. Once more than 100 records are held, each read drops some from the front. Every remaining row's `i` shifts, so its id changes, and DataGrid remounts all 100 rows on every 250 ms poll while coords are on. Trace and history rows are keyed by their place in the page's ring (`sequenced`) to avoid exactly this. `slice.coords.cursor` would give coord records the same kind of key.
- evidence: read
- severity: low

## ValueView gives two rows the same React key when an object has a real `…` key and was cut
- where: packages/devtools/src/views/ValueView.tsx:254 (entriesOf), with :316 and :335 (`key={k}`)
- scenario: serialize `{ '…': 1, ...100 more keys }`. `entriesOf` lists the object's own `…` key, then adds the "N more" row (`moreRow`) also named `…`, and both render with `key="…"`. React warns about the duplicate and can give one row the other's open or closed state.
- evidence: read
- severity: low

## RegistryBrowser's entry keys collide when a category id contains `/`
- where: packages/devtools/src/views/RegistryBrowser.tsx:336 (leafKey)
- scenario: RegistryBrowser is public: an app can feed it a static catalog with its own category ids. Category `a/b` with entry `c`, and category `a` with entry `b/c`, both get the key `a/b/c`. The pick map keeps only the second, so clicking the first selects the other entry, and the Tree gets two nodes with the same id. The key needs an encoding that can't be ambiguous.
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

<!-- done: 8 findings, files read: 37 -->