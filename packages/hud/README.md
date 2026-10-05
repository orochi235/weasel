# @weasel-js/hud

WebGL-rendered UI widgets that composite into a weasel canvas

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/api/).

## Install

```sh
npm install @weasel-js/hud
```

## Usage

```ts
import { /* … */ } from '@weasel-js/hud';
import { /* … */ } from '@weasel-js/hud/react';
```

## Widgets

`rect`, `text`, `image`, `label`, `button`, and `window` — a draggable,
resizable frame whose interior is painted by an opt-in `content` callback. See
[`src/widgets/window`](src/widgets/window/README.md) for how content composes
with the frame, and `createLoupe` in [`src/loupe`](src/loupe) for the first
consumer.

Widgets draw from a data-free context (`{ dims, defaultFont, tokens }`), which
is what lets a HUD render headlessly and identically. A window's `content`
painter is the single, explicit exception.

## HUD or DOM text?

Measured in `tests/perf/README.md` ("HUD text against a DOM overlay"): at a
hundred glyphs the choice costs nothing either way. Past that, static labels on
a fixed camera are cheaper in a DOM layer over the canvas, because the renderer
walks every HUD text command on each repaint, and text that follows a pure pan
is cheapest in a DOM layer moved as one element. Readouts that change every
frame tie on the main thread and, from 2,500 glyphs, cost the HUD about 1 ms
less a frame across all threads, mostly in the compositor and GPU process; a React-rendered overlay costs more than
either whenever its labels change.

## License

MIT
