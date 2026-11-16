# @weasel-js/devtools

A devtools panel for weasel canvases, and the hook a page installs for it. Each
`<SceneCanvas>` that takes the `devtools` contribution registers with the hook,
and the panel reads and steers it: it never edits a scene.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic
scene-graph engine for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/devtools).

```sh
npm install @weasel-js/devtools
```

```tsx
import { AmbientContributionsProvider } from '@weasel-js/core';
import { DevtoolsPanel, createInPagePanelTransport } from '@weasel-js/devtools';
import { devtools } from '@weasel-js/devtools/hook';
import '@weasel-js/devtools/style.css';

const transport = createInPagePanelTransport();

<AmbientContributionsProvider contributions={[devtools]}>
  <App />
  <div className="devtools-dock">
    <DevtoolsPanel transport={transport} />
  </div>
</AmbientContributionsProvider>;
```

A canvas that does not take `devtools` is not listed, and pays nothing for it.
`<SceneCanvas ambient={[devtools]}>` hands it to one canvas.

The panel fills its container, so give the container a size.

| Tab | Shows | Steers |
|---|---|---|
| Scene | the node tree, loaded a level at a time; a node's parent, pose and data | `select` the picked node; hovering a row outlines it on the canvas |
| State | selection, view, active tool, overlay flags, probes | the active tool; each debug overlay flag |
| Registry | the canvas's registered tools, actions and deps, filtered by name, beside the entry picked | — |
| Dispatch | every resolved input and mode switch, newest first, under what a press at the pointer would do; coord records behind a toggle | — |
| History | each step the scene's history took, newest first, and where it stands; every entry on its stacks behind a toggle | — |
| Frame | the last paint's CPU time and draw calls, per render layer, while the `fps` overlay is on | the `fps` overlay |

`tabs={['dispatch']}` shows only the tabs named, and drops the tab bar when
one is left.

## Entries

| Entry | Holds |
|---|---|
| `@weasel-js/devtools` | the panel, its protocol client, `createInPagePanelTransport` |
| `@weasel-js/devtools/hook` | the page's side: the `devtools` contribution, the hook on `window.__weaselDevtools__`, roots |
| `@weasel-js/devtools/protocol` | the messages, transports and serializer; no React and no core, for an extension's scripts |

## Transports

`DevtoolsPanel` takes any `PanelTransport` (`{ send, onMessage }`).
`createInPagePanelTransport()` reaches this page's own hook, opening a fresh
session on each `yo`, so a panel that remounts reconnects. An extension passes
the panel end of whatever bridge carries messages to the page.

## Without React

`connectDevtools(transport)` is the protocol client the panel is built on: the
handshake, numbered requests and their replies, the roots the page reports, and
its change notices. `followTrace(client, rootId)` reads a canvas's dispatch
trace a slice at a time through its cursors.
