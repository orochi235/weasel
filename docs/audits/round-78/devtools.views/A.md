# Audit round 78: devtools.views (reviewer findings)

## Flipping one overlay in the State tab pins every debug flag over the canvas's own settings
- where: packages/devtools/src/views/StateView.tsx:68 (StateView, CheckboxGroup onChange)
- scenario: the panel is open on a canvas whose app toggles its own debug flags (for example, a "show fps" menu item
  that sets the canvas's `debug.fps`). The user flips `bounds` in the State tab. `onChange` sends every flag in
  `DEBUG_FEATURES` with its current value, and `session.steer` merges them into the override, which `overrideFlags`
  (page/attach.ts:40) lays over the canvas for every flag that is a boolean. From then on, every flag the user never
  touched is pinned at whatever it was when `bounds` was flipped, so the app's own later change to `fps` (or any
  other flag) has no effect until the panel closes. What should happen: only the flag the user changed is overridden.
  The Frame tab's fps switch shows the narrower form, sending `{ fps: on }` alone (FrameView.tsx:58), so the two
  tabs answer "which flags does a panel change override" differently.
- evidence: read (StateView.tsx, FrameView.tsx, page/attach.ts overrideFlags, page/session.ts steer)
- severity: low

## `defaultOpen` leaves a grouped category's parent branch closed when the category is not in the mount-time list
- where: packages/devtools/src/views/RegistryBrowser.tsx:120 (RegistryBrowser, openIds initializer)
- scenario: a host using `RegistryBrowser` for an app catalog loaded asynchronously renders it first with
  `categories={[]}` and `defaultOpen={['shapes']}`, then with the loaded list, where `shapes` has `group: { id: 'draw' }`.
  The initializer runs once, finds no `shapes` category, and opens only `cat:shapes`, never `group:draw`. The
  category is "open" inside a closed group, so it doesn't show, even though the prop promises it is open at mount. What
  should happen: the group key is opened as soon as the category appears, or `defaultOpen` is resolved against the
  categories when they arrive. RegistryView avoids this only because it renders the browser after the registry has
  loaded.
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
