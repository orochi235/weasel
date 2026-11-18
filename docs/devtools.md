# Devtools hook

How a page running weasel exposes its canvases to a devtools panel: what the page publishes, the
messages a panel sends and gets back, and what a production app has to do to allow it. For anyone
building a panel, an extension, or a console probe against `window.__weaselDevtools__`.

The panel is `@weasel-js/devtools` ("Mounting the panel", below); the browser extension is under
"Extension".

## What the page publishes

A page publishes nothing until a canvas takes the `devtools` contribution. Its `attach` installs the
hook on `window.__weaselDevtools__`, once per page, and registers its canvas as a **root**, which
leaves when the canvas unmounts. Without it a canvas keeps no root, no history record and no coord
trace (2026-11-15).

**A kit shell takes it by default in development (2026-11-15).** `<Lab>`, `EditorShell` and forge's
story frames wrap their canvases in `ShellDevtools` from `@weasel-js/devtools/mount`, which gives
every canvas below them `devtools` when `isDev()` holds (`process.env.NODE_ENV` is not
`production`). It is `lazyDevtools`, which loads the hook by dynamic import on first attach, so a
production bundle never loads it. Each shell takes the same switch:

| Shell | Switch |
|---|---|
| `<Lab>` (labkit) | `devtools` prop |
| `EditorShell` (editor) | `devtools` prop |
| a forge frame | `devtools` in `defineFrameConfig` |

`false` withholds it; `true` mounts it in a production build too. Left out, a `devtools` entry
provided above the shell decides, and with none, the build does. So an app turns it off for every
shell under it by providing `devtoolsOff`, an entry with the `devtools` id and no roles that
replaces any `devtools` entry provided further out:

```tsx
import { AmbientContributionsProvider } from '@weasel-js/core';
import { devtoolsOff } from '@weasel-js/devtools/mount';

const OFF = [devtoolsOff];
<AmbientContributionsProvider contributions={OFF}><App /></AmbientContributionsProvider>;
```

A bare `<SceneCanvas>` takes it only when asked, since core cannot depend on devtools. Every
canvas below an `AmbientContributionsProvider` given `DEV_DEVTOOLS` (`[lazyDevtools]` in
development, `[]` in production) takes it, as draw's dev surfaces and the site's demos do;
`<SceneCanvas ambient={[devtools]}>` gives one canvas the eager contribution from
`@weasel-js/devtools/hook`, and a canvas's own `ambient` entry wins over any provided one. A canvas
whose `tools` prop is a `ToolsApi` takeover ignores provided entries, as it does for any ambient
contribution, so it takes `devtools` in its takeover's `ambient`. Whether a production build takes
it is the app's call (2026-10-18).

The contribution reads its canvas through the canvas's api and its `scene`, `selection`,
`dispatchTrace`, and `inspection` deps. `inspection` is core's `CanvasInspection`, which `<SceneCanvas>` sources for any
inspector: its tools, preset contributions, node kinds, actions and dep registries, the debug flags
in effect and a setter laying flags over them, its `clientToWorld` trace (kept only once asked
for), its test probes, its `<DevtoolsLabel>`, and a change feed.

A root is labeled by its canvas's `aria-label`, else its DOM id, else the `value` of the nearest
`<DevtoolsLabel>` above it, else the `aria-label` of its nearest labeled ancestor, else its root id.
A host that frames canvases it did not write wraps them in `<DevtoolsLabel>`, which stays in core so
the host need not depend on devtools: a labkit trial does, with its title, so a canvas in a trial is
not named after the pane it sits in. A root's dimension is `3d` when its first node's pose has a
`position.z`, else `2d`.

`window.__weaselDevtools__` is `{ protocol, kitVersion, roots(), root(id), register(root),
connect(transport, opening?) }`.

The panel inspects and steers; it never edits the scene (2026-10-18).

## Connecting

A transport is `send(message)` plus `onMessage(listener)`, from `@weasel-js/devtools/protocol`, which
installs nothing and loads neither React nor core — what a panel in its own window, and the
extension's background and content scripts, import:

- `createInPageTransports()` — both ends in one page, delivered by direct call. Pass `page` to
  `hook.connect` and talk over `panel`. A session ends at `bye`, so a panel that reconnects needs a
  fresh `connect`; `@weasel-js/devtools`'s `createInPagePanelTransport()` opens one on each `yo`.
- `createWindowPanelTransport()` — over `window.postMessage`, in an envelope tagged
  `source: 'weasel-devtools'`. Installing the hook starts a `message` listener, so a content script
  needs no access to page objects: its `yo` opens the connection, replacing any earlier one.

`@weasel-js/devtools/hook` holds the page's side: `devtools`, `attachDevtools`, and the hook's and
roots' constructors (`installDevtoolsHook`, `createDevtoolsHook`, `createDevtoolsRoot`).
`@weasel-js/devtools/mount` holds what loads it lazily: `lazyDevtools`, `DEV_DEVTOOLS`,
`devtoolsOff` and `ShellDevtools`.

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
| panel → page | `get-history` | `cursor`, optional `historyEntries` → history steps after the cursor, the next cursor, where the history stands, and every entry's label when asked (see "History" below) |
| panel → page | `get-frame` | → the debug sink's stats for the last paint; null until the `fps` overlay is on. Not announced by `changed`: poll it |
| panel → page | `select` | `ids` |
| panel → page | `highlight` | `ids`: outlined through the debug overlay's `highlight` feature |
| panel → page | `set-tool` | `toolId`, which must be registered, or null |
| panel → page | `set-overlays` | debug overlay flags, merged over earlier ones and laid over the canvas's own `debug` prop |

Values a panel did not author — node data, poses, probes, trace records — pass through `serialize`.
What JSON cannot say arrives as an object tagged with `$type`: functions `{ $type: 'function', name }`,
typed arrays `{ $type, length }`, maps and sets `{ $type, size, entries }`, cycles `{ $type: 'cycle' }`.
A plain object's own keys starting with `$` get one more `$`, and depth, length and string size are
capped.

## Traces

A canvas keeps two rolling buffers of 200: its dispatchers' decisions (`DispatchTrace`, on every
`DispatcherContext` and published as the `dispatchTrace` dep) and, from the moment the `devtools`
contribution asks for it, its `clientToWorld` conversions. Both record in a dev build, and in
production only while a panel is connected.

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

The `devtools` contribution keeps a rolling buffer of its canvas's scene's history steps, 200 long,
fed by `History.observe` on `scene.history`. Like the traces, it records in a dev build, and in production
only while a panel is connected. Each record is `{ ts, step, entries, position }`:

- `step` — `push`, `coalesce` (a push merged into the entry on top), `undo`, `redo`, `goto`,
  `branch`, `prune`, `drop` (the redo entries `dropRedo` took), `clear` or `restore`.
- `entries` — what the step pushed, merged into or walked across, in the order it touched them,
  up to 50: each `{ id, label, opCount, ops }`, where `ops` holds up to 50 of the entry's ops as
  `{ kind, targets, summary }`. `kind` is the op's registered name (`kit:setPose`, a consumer's
  `registerOp` kind); `targets` are the node ids its args address; `summary` is its args through
  `serialize`. A coalesce lists the ops it brought, not the merged entry's.
- `position` — entries applied, and entries in all, after the step.

`get-history` also returns the position now, with `canUndo` and `canRedo`, and with
`historyEntries: true`, every entry on the stacks as `{ id, label }`, oldest applied first. Edits made
inside a mode's journal reach the scene's history only when the journal commits, as one push.

## Mounting the panel

`DevtoolsPanel` from `@weasel-js/devtools` takes the panel's end of any transport and fills its
container. In the page itself, beside canvases that take `devtools` (above):

```tsx
import { DevtoolsPanel, createInPagePanelTransport } from '@weasel-js/devtools';
import '@weasel-js/devtools/style.css';

const transport = useMemo(() => createInPagePanelTransport(), []);
<div className="dock"><DevtoolsPanel transport={transport} /></div>
```

Its tabs are Scene (the node tree and a picked node's pose and data), State (selection, view,
tool, overlay flags and probes), Registry (tools, actions and deps under a name filter, each with
its bindings in the route grammar), Dispatch (the trace and the live prediction), History (each
step with its ops, where the history stands, and the checkpoint stack on request) and Frame (paint
cost while the `fps` overlay is on). Registry re-reads on `selection` and `scene` as well as
`registry`, since `enabled` and `active` are not announced.

The panel lays itself out by its own width (a container query): below 480 px the tree or list
stacks above the detail, and the tabs wrap onto a second row.

It says `yo` on mount and `bye` on unmount, which drops its highlight and overlay flags. Mount it
in development only, behind a lazy import, so production bundles leave it out:
`import.meta.env.DEV ? lazy(() => import('./Devtools')) : null`. The repo mounts it that way, beside
canvases that take `devtools` in development, in three places: draw's right sidebar (a folding Devtools panel), each demo page of the site (a
Devtools switch in the demo's header, which splits the page with the demo narrowing), and forge (a Devtools global in the workshop toolbar, which
puts the panel beside the story). `tabs={['dispatch']}` shows a subset; draw's Toolkit Builder
uses it for its dispatch widget. Draw's Bundle Inspector (`#/dev/registry`) keeps only draw's static
catalog (bundles, gestures, slots, ops, icons, traits); a canvas's live registry is the panel's.

## Extension

`apps/devtools-extension` hosts `DevtoolsPanel` in the browser's own devtools, for Chrome, Edge, and
Firefox, and for Safari through an Xcode wrapper. Its content script relays
`createWindowPanelTransport`'s envelopes, so it works on any page with a hook, frames included: a
page whose canvases take `devtools`. A
content script connects only while a panel is open on its tab. Its toolbar button badges each tab with
the number of canvases the page's hook reports. Building it, loading it unpacked, and
packaging it for Safari are in its [README](../apps/devtools-extension/README.md).
