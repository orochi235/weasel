# Audit round 45 — devtools.page (reviewer findings)

## `set-overlays` accepts any boolean-valued key, so `{ highlight: true }` reaches the debug sink as a non-array and throws
- where: packages/devtools/src/page/messageShape.ts:39 (isPanelMessage, `set-overlays`); packages/devtools/src/page/attach.ts:67 (canvasRoot `setOverride`)
- scenario: a panel (or anything else that can post to the window) sends `{ type: 'set-overlays', protocol: 1, requestId: 1, rootId, overlays: { highlight: true } }`. The shape check only requires every value to be a boolean, not every key to be a `DebugFeature`, so it passes. `session.steer` merges it into the override, and `setOverride` spreads `o.overlays` into the `DebugFlags` it hands `setDebugOverride`; with no panel highlight (`o.highlight.length === 0`) nothing replaces it, so the canvas's config gets `highlight: true`. `createDebugSink` then runs `new Set(config.highlight)` (packages/core/src/debug/createDebugSink.ts:31/33), which throws `TypeError: boolean true is not iterable` on the canvas's debug path. Same gap admits `theme: true` / `strokes: true` / arbitrary keys into `DebugFlags`. The validator should accept only `DEBUG_FEATURES` keys that are boolean features (as the protocol type `Partial<Record<DebugFeature, boolean>>` says), or `setOverride` should copy only those.
- evidence: read
- severity: medium

## A root's override is never cleared when the root is unregistered while its canvas stays mounted
- where: packages/devtools/src/page/session.ts:48 (dropOverride) with packages/devtools/src/page/hook.ts:59-62 (register's removal)
- scenario: the hook's removal does `live.delete(root.id)` before emitting `{ removed }`, and the session's handler calls `dropOverride(id)`, which looks the root up with `host.root(rootId)` — now `undefined` — so `setOverride(null)` is never called. The canvas keeps the panel's overlays and highlight via `inspection.setDebugOverride`, which is canvas state. This happens whenever the devtools contribution detaches from a live canvas: the `devtools` entry is removed from `<AmbientContributionsProvider contributions>`, or `useKeyedInstall` reinstalls it because the canvas api or dep registry identity changed (it re-registers under a new root id). The highlight outline and forced overlays then stay on the canvas indefinitely, and the panel's `bye` can't clear them because the session no longer holds that override. `dropOverride` should keep the `DevtoolsRoot` (e.g. in the `overrides` map, or pass it in the removed event) rather than look it up after removal.
- evidence: read
- severity: medium

## The window hook accepts a `yo` from any frame, so an embedded iframe can take over (and disconnect) the extension's session
- where: packages/devtools/src/page/hook.ts:78-82 (serveWindow); packages/devtools/src/page/transport.ts:61-63 (windowTransport.onMessage)
- scenario: neither listener checks `e.source === target` (or the origin). A cross-origin iframe on the page (an ad, an embed) runs `parent.postMessage({ source: 'weasel-devtools', side: 'panel', message: { type: 'yo', protocol: 1 } }, '*')`. `serveWindow` closes the extension's live session (dropping its overrides and notices) and opens a new one; the extension panel's later requests are now answered by a session it did not greet, and the iframe can send `select`, `set-tool`, `highlight` and `set-overlays` to steer every canvas on the page. The content script posts on the page's own window, so `e.source === window` would admit it and refuse other frames.
- evidence: read
- severity: medium

## A 3D canvas whose scene is empty when it registers is announced, and stays, `'2d'`
- where: packages/devtools/src/page/attach.ts:23-27 (dimensionOf)
- scenario: `dimensionOf` decides the dimension from the first root's pose having a numeric `position.z`; with no roots it returns `'2d'`. A kernel3d canvas mounts with an empty scene (nodes added after load, or a scene cleared and rebuilt), so `root-added` / `sup` carry `dimension: '2d'`. Nothing re-announces a root's info when the scene fills, so the panel treats a 3D canvas as 2D for the rest of the connection. The canvas's dimension should come from the canvas (its pose kind / host), not be guessed from scene content.
- evidence: read
- severity: low

## The history ring is not reset when the canvas's scene is swapped, so `get-history` mixes the old scene's steps with the new scene's position
- where: packages/devtools/src/page/attach.ts:43-52 (canvasRoot followHistory); packages/devtools/src/page/history.ts:39-52 (historySlice)
- scenario: a `<SceneCanvas>` gets a new `scene` prop (opening another document). `followHistory` stops recording the old `scene.history` and starts on the new one, but keeps the same `history` ring, so its records of the old document's pushes/undos remain and the cursor keeps counting. `historySlice` returns those entries beside `position`, `canUndo`/`canRedo` and `historyEntries` read from the new scene: the panel shows steps, entry ids and labels that belong to a different history, with positions (`index/total`) that don't match the stack it lists. The ring should be cleared (or a fresh ring started and the panel told via a `history` notice) when the followed scene changes.
- evidence: read
- severity: low

## `serialize` writes an Error, RegExp, ArrayBuffer, DataView, WeakMap, Promise and similar built-ins as `{}`, contrary to its contract
- where: packages/devtools/src/page/serialize.ts:142-151 (serialize, plain-object branch)
- scenario: the module doc says everything that is not an array or a plain object "arrives as an object whose `$type` names it". For a value whose `Object.prototype.toString` tag is not `Object` and that is not one of the handled tags (Date, Map, Set, typed arrays), the code falls through to the plain-object branch; `$class` is only written when `tag === 'Object'`, and these have no own enumerable keys. So a probe returning `new Error('boom')`, `/a+/`, `new ArrayBuffer(8)` or a trace record carrying an Error arrives as `{}`, indistinguishable from an empty object, with the message lost. Such values should get a `$type` (and, for Error, its message).
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

<!-- done: 6 findings, files read: 12 -->
