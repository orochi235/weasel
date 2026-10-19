# @weasel-js/devtools

A devtools panel for weasel canvases. It connects to the devtools hook every
`<SceneCanvas>` registers with (`@weasel-js/core/devtools`), and reads and
steers each canvas on the page: it never edits a scene.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/devtools).

```sh
npm install @weasel-js/devtools
```

```tsx
import { DevtoolsPanel, createInPagePanelTransport } from '@weasel-js/devtools';
import '@weasel-js/devtools/style.css';

const transport = createInPagePanelTransport();

<div className="devtools-dock">
  <DevtoolsPanel transport={transport} />
</div>;
```

The panel fills its container, so give the container a size.

| Tab | Shows | Steers |
|---|---|---|
| Scene | the node tree, loaded a level at a time; a node's parent, pose and data | `select` the picked node; hovering a row outlines it on the canvas |
| State | selection, view, active tool, overlay flags, probes | the active tool; each debug overlay flag |
| Dispatch | every resolved input and mode switch, newest first, under what a press at the pointer would do; coord records behind a toggle | — |
| Frame | the last paint's CPU time and draw calls, per render layer, while the `fps` overlay is on | the `fps` overlay |

`tabs={['dispatch']}` shows only the tabs named, and drops the tab bar when
one is left.

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
