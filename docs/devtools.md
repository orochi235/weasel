# Devtools hook

How a page running weasel exposes its canvases to a devtools panel: what the page publishes, the
messages a panel sends and gets back, and what a production app has to do to allow it. For anyone
building a panel, an extension, or a console probe against `window.__weaselDevtools__`.

A panel in the page is not built yet (`docs/TODO.md`, "Devtools"). The browser extension is under
"Extension" below.

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
| page → panel | `changed` | `areas`: each of `scene`, `selection`, `view`, `tool`, `trace`, `registry`, `history` that moved, with its version; at most one per root per animation frame |
| panel → page | `get-children` | `nodeId`, or none for the top level → each child's id, kind, layer, child count, hidden / locked / pickable |
| panel → page | `get-node` | `nodeId` → the same, plus parent, pose and data |
| panel → page | `get-state` | → selection, view, active tool, registered tools, overlay flags in effect, probe values |
| panel → page | `get-trace` | `cursor`, optional `coordCursor` → dispatch and mode-switch records after the cursor, the next cursor, `live` (what a press at the pointer would do), and coord records when asked |
| panel → page | `get-registry` | → what the canvas registered: tools, actions, deps and node routing kinds (see "Registry" below) |
| panel → page | `get-history` | `cursor`, optional `checkpoints` → history steps after the cursor, the next cursor, where the history stands, and every entry's label when asked (see "History" below) |
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

## Registry

`get-registry` describes what one canvas has registered, read when asked. `changed` reports
`registry` when an action or a dep source comes or goes, or the canvas's tools, preset
contributions or `routing` change.

| Field | Each item |
|---|---|
| `tools` | every entry the dispatcher assembles bindings from: `slot` is `tool` (switchable), `ambient` (always on) or `contribution` (brought by a `features` preset); label, icon name, group, shortcut, hotkey, hidden, cursor, eligibility, `bindings`, the ids of the actions it brings, the names of the deps it registers, whether it draws an overlay |
| `actions` | id, label, icon name, group, tags, shortcut, `scope` (`hotkey` or `ambient`), invoker timing, `requires`, variants, `enabled` (`true` or the reason), `active` (null for no pressed state), whether it has a preview, its eligibility rule, and the bindings its `defaultBinding` declares |
| `deps` | each name the canvas's dep registry answers, how many scopes above the canvas's own its live source sits (`depth`), and how many sources are stacked under it there |
| `routingKinds` | the node kinds a binding's `kind:` target can name, in classify order |

A binding is `{ actionId, spec, routes, opts }`, where `routes` is the spec in the route grammar.
`enabled` and `active` are asked with the deps each action requires at the moment of the request;
`changed` does not announce them, so a panel showing them re-reads on `selection` or `scene`.

## History

A canvas keeps a rolling buffer of its scene's history steps, 200 long, fed by
`History.observe` on `scene.history`. Like the traces, it records in a dev build, and in production
only while a panel is connected. Each record is `{ ts, step, entries, position }`:

- `step` — `push`, `coalesce` (a push merged into the entry on top), `undo`, `redo`, `goto`,
  `branch`, `prune`, `clear` or `restore`.
- `entries` — what the step pushed, merged into or walked across, in the order it touched them,
  up to 50: each `{ id, label, opCount, ops }`, where `ops` holds up to 50 of the entry's ops as
  `{ kind, targets, summary }`. `kind` is the op's registered name (`kit:setPose`, a consumer's
  `registerOp` kind); `targets` are the node ids its args address; `summary` is its args through
  `serialize`. A coalesce lists the ops it brought, not the merged entry's.
- `position` — entries applied, and entries in all, after the step.

`get-history` also returns the position now, with `canUndo` and `canRedo`, and with
`checkpoints: true`, every entry on the stacks as `{ id, label }`, oldest applied first. Edits made
inside a mode's journal reach the scene's history only when the journal commits, as one push.

## Extension

`apps/devtools-extension` is a browser extension that hosts the panel in the browser's own devtools,
for Chrome, Edge, and Firefox, and for Safari through an Xcode wrapper. Its content script relays
`createWindowPanelTransport`'s envelopes, so it works on any page with a hook. Building it, loading
it unpacked, and packaging it for Safari are in its
[README](../apps/devtools-extension/README.md).
