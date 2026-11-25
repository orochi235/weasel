# Audit round 45 — devtools.page

## `set-overlays` takes any key, so `{ highlight: true }` lands in the canvas's debug config and makes the debug sink throw
- where: packages/devtools/src/page/messageShape.ts:39 (isPanelMessage, `set-overlays`); packages/devtools/src/page/attach.ts:67 (source.setOverride)
- scenario: a panel (or anything posting to the window) sends `{ type: 'set-overlays', overlays: { highlight: true } }` with no highlight set. The shape check only requires every value to be boolean, not every key to be a `DebugFeature`. `steer` stores it in `overlays`, and `setOverride` spreads `o.overlays` into the `DebugFlags` and adds `highlight` only when the panel's highlight list is non-empty, so the panel's `highlight: true` survives. `withOverride` (core/debug/override.ts) lays it over the canvas's `debug`, and `createDebugSink` runs `new Set(config.highlight)`, which throws `TypeError: boolean true is not iterable`. `{ theme: true }` and `{ strokes: true }` likewise replace the object-valued settings with a boolean. Expected: only `DEBUG_FEATURES` keys are accepted, or `setOverride` copies only those.
- evidence: read (messageShape.ts:39, attach.ts:67-69, core/src/debug/override.ts:11, core/src/debug/createDebugSink.ts:33)
- severity: medium

## A removed root keeps the panel's overlay and highlight override on its canvas
- where: packages/devtools/src/page/session.ts:49 (dropOverride), :69 (onRoots `removed`); packages/devtools/src/page/hook.ts:60-62 (register's removal)
- scenario: the hook deletes the root from `live` before emitting `{ removed }`. `dropOverride` then calls `host.root(rootId)?.source.setOverride(null)`, which finds nothing, so `setOverride(null)` never runs. The override is lost only when the canvas itself unmounts. When the devtools contribution detaches and the canvas stays mounted, the canvas keeps drawing the panel's highlight and forced overlays with no way to clear them. This happens when `devtools` is taken out of `<AmbientContributionsProvider contributions>`, or when `useKeyedInstall` reinstalls because `api` or `depRegistry` changed, which creates a new root id. The panel is told `root-removed`. Expected: the session keeps the root object next to its override, or the hook emits before it deletes, so the override is cleared on the canvas.
- evidence: read
- severity: medium

## The page accepts a `yo` and requests from any frame, so another origin's iframe can connect and steer the canvas
- where: packages/devtools/src/page/hook.ts:78-81 (serveWindow); packages/devtools/src/page/transport.ts:61-62 (windowTransport.onMessage)
- scenario: neither listener checks `e.source === window` (or `e.origin`). An embedded cross-origin iframe can run `parent.postMessage({ source: 'weasel-devtools', side: 'panel', message: { type: 'yo', protocol: 1 } }, '*')`, which opens a session and replaces the real panel's. It can then post `select`, `set-tool`, `highlight` or the crashing `set-overlays` above, and the page acts on each one. All real traffic comes from the content script, which posts on the page's own window, so its `e.source` is always `window`. Expected: messages whose `source` is not the page's own window are ignored.
- evidence: read
- severity: low

## An emptied override still forces the debug overlay on until the panel closes
- where: packages/devtools/src/page/session.ts:52-60 (steer); packages/devtools/src/page/attach.ts:67-69
- scenario: the canvas has `debug` unset or `false`. The panel highlights a node, then clears the highlight (`highlight` with `ids: []`), or turns a feature on and off again. `steer` keeps `{ overlays: {}, highlight: [] }` and calls `setOverride` with it rather than `null`, so `setDebugOverride({})` runs. `withOverride` returns `{...(resolveDebugFlags(false) ?? {}), ...{}}`, which is `{}`, a truthy config. The overlay stays mounted, and `get-state` reports overlays from `{}` instead of from the canvas's own "off". The same applies to a `{ bounds: false }` override on a canvas whose overlay was off. Expected: an override with no flags and no highlight is dropped (`setOverride(null)`).
- evidence: read (core/src/debug/override.ts:10-11)
- severity: low

## A root keeps the trace, coords and history rings it first saw, while its getters read the current dep
- where: packages/devtools/src/page/root.ts:98-101 (attach); packages/devtools/src/page/notices.ts:42-44 (follow); packages/devtools/src/page/attach.ts:63-64 (trace and coords getters), :105 (offScene)
- scenario: `source.trace` and `source.coords` re-read `deps.get('dispatchTrace')` and `inspection()` on every access. But `watch()` and `subscribe()` run once: when a session follows the root, and when the root gains its first listener. `useGestureDispatcher` re-registers `dispatchTrace` whenever its `trace` changes (routing useGestureDispatcher.tsx:76, deps `[depRegistry, trace]`). Before the dispatcher has published, the getter returns the shared `NO_TRACE`. In either case the watcher sits on the old ring. In a production build the new ring never records (`recording()` is `dev || watchers > 0`), no `trace` notices arrive, and `get-trace` reads the new ring with a cursor taken from the old one. Likewise `canvasRoot` subscribes to `inspection()` once, at creation, so `followHistory` never runs if the inspection dep was not there yet or is replaced. Expected: a dep change re-binds the watch and the subscription, or the root reads one captured ring.
- evidence: read (the dep-identity change is reasoned from useGestureDispatcher's effect, not reproduced)
- severity: low

## A root's `dimension` is reported once, from the first root node at register time, so a 3D canvas that mounts empty is listed as 2d
- where: packages/devtools/src/page/attach.ts:23-27 (dimensionOf), :55; packages/devtools/src/page/root.ts:114 (info)
- scenario: a kernel3d canvas mounts with an empty scene, or with a scene that loads after mount. `dimensionOf` finds no `roots[0]` and returns `'2d'`. `root-added`/`sup` carry that info, and no message ever updates it, so the panel shows a 3D canvas as 2D for its whole life. An empty 3D scene always reads as 2d. Expected: the dimension comes from the canvas or pose kind rather than the first node's pose, or a changed dimension is re-announced.
- evidence: read
- severity: low

## `connect` keeps listening on the transport after the panel says `bye`
- where: packages/devtools/src/page/hook.ts:65-69 (connect); packages/devtools/src/page/session.ts:102
- scenario: on `bye`, `session.close()` runs, but the `transport.onMessage` subscription that `connect` made is removed only by the returned close. A caller using in-page transports that waits for `bye`, as the doc comment ("until the panel says `bye` or the returned close is called") suggests it can, leaks one listener per connection, and each later message still reaches a dead session. Expected: a session closed by `bye` also releases `off`.
- evidence: read
- severity: low

## `serialize` writes Errors, RegExps, DataViews, ArrayBuffers, DOM nodes and similar built-ins as a bare `{}`
- where: packages/devtools/src/page/serialize.ts:142-151 (walk, object branch)
- scenario: `$class` is added only when `tagOf(obj) === 'Object'`. Any other built-in tag (`Error`, `RegExp`, `DataView`, `ArrayBuffer`, `HTMLDivElement`, `Promise`, `WeakMap`) falls through to `Object.keys`, finds no own enumerable keys, and comes out as `{}`: no `$type`, no `$class`, no message. A probe returning `new Error('boom')`, or a node's `data` holding a RegExp or a DOM element, shows in the panel as an empty object, the same as a real `{}`. Also, the Map/Set branch is chosen by tag alone, so an object whose `Symbol.toStringTag` is `'Map'` but which is not iterable throws out of `serialize` and fails the whole `get-node`. Expected: such values carry their tag (`$class` or `$type`), as typed arrays and Dates do.
- evidence: read
- severity: low

## Files read
packages/devtools/src/page/attach.ts
packages/devtools/src/page/handlers.ts
packages/devtools/src/page/history.ts
packages/devtools/src/page/hook.ts
packages/devtools/src/page/messageShape.ts
packages/devtools/src/page/notices.ts
packages/devtools/src/page/protocol.ts
packages/devtools/src/page/registry.ts
packages/devtools/src/page/root.ts
packages/devtools/src/page/serialize.ts
packages/devtools/src/page/session.ts
packages/devtools/src/page/transport.ts

<!-- done: 8 findings, files read: 12 -->
