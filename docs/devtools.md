# Devtools hook

How a page running weasel exposes its canvases to a devtools panel: what the page publishes, the
messages a panel sends and gets back, and what a production app has to do to allow it. For anyone
building a panel, an extension, or a console probe against `window.__weaselDevtools__`.

A panel in the page and the browser extension are not built yet (`docs/TODO.md`, "Devtools").

## What the page publishes

Each mounted `<SceneCanvas>` is a **root**. It registers with the hook on mount and leaves on
unmount, labeled by its `aria-label` (else its root id). A root's dimension is `3d` when its first
node's pose has a `position.z`, else `2d`.

`window.__weaselDevtools__` is `{ protocol, kitVersion, roots(), root(id), register(root),
connect(transport, opening?) }`.

| Build | Hook installed |
|---|---|
| dev (`isDev()`) | by the first `<SceneCanvas>` to mount |
| production | only when the app imports `@weasel-js/core/devtools` (decided per app, 2026-10-18) |

A production build carries the hook's code either way; without the import it never installs it.

The panel inspects and steers; it never edits the scene (2026-10-18).

## Connecting

A transport is `send(message)` plus `onMessage(listener)`, from `@weasel-js/core/devtools`:

- `createInPageTransports()` — both ends in one page, delivered by direct call. Pass `page` to
  `hook.connect` and talk over `panel`. `apps/draw/src/dev/dispatchTraceLog.ts` is a working client.
- `createWindowPanelTransport()` — over `window.postMessage`, in an envelope tagged
  `source: 'weasel-devtools'`. Installing the hook starts a `message` listener, so a content script
  needs no access to page objects: its `yo` opens the connection, replacing any earlier one.

## Messages

Every message carries `protocol` (now `1`). Requests also carry `requestId` and `rootId`; the reply
is a `result` or `error` with the same `requestId`. A message in another protocol gets an `error`
naming both versions, and the panel decides how far to degrade.

| Direction | Message | Carries |
|---|---|---|
| panel → page | `yo` | — |
| page → panel | `sup` | `kitVersion`, `roots` |
| panel → page | `bye` | — : drops this panel's overlays and highlight, and stops tracing for it |
| page → panel | `root-added` / `root-removed` | the root / its id |
| page → panel | `changed` | `areas`: each of `scene`, `selection`, `view`, `tool`, `trace` that moved, with its version; at most one per root per animation frame |
| panel → page | `get-children` | `nodeId`, or none for the top level → each child's id, kind, layer, child count, hidden / locked / pickable |
| panel → page | `get-node` | `nodeId` → the same, plus parent, pose and data |
| panel → page | `get-state` | → selection, view, active tool, registered tools, overlay flags in effect, probe values |
| panel → page | `get-trace` | `cursor`, optional `coordCursor` → dispatch and mode-switch records after the cursor, the next cursor, `live` (what a press at the pointer would do), and coord records when asked |
| panel → page | `get-frame` | → the debug sink's stats for the last paint; null until the `fps` overlay is on. Not announced by `changed`: poll it |
| panel → page | `select` | `ids` |
| panel → page | `highlight` | `ids`: outlined through the debug overlay's `highlight` feature |
| panel → page | `set-tool` | `toolId`, which must be registered, or null |
| panel → page | `set-overlays` | debug overlay flags, merged over earlier ones and laid over the canvas's own `debug` prop |

Values a panel did not author — node data, poses, probes, trace records — pass through `serialize`:
functions become `ƒ name`, typed arrays `{ $type, length }`, maps and sets `{ $type, size, entries }`,
cycles `'[cycle]'`, and depth, length and string size are capped.

## Traces

A canvas keeps two rolling buffers of 200: its dispatchers' decisions (`DispatchTrace`, on every
`DispatcherContext` and published as the `dispatchTrace` dep) and its `clientToWorld` conversions.
Both record in a dev build, and in production only while a panel is connected.
