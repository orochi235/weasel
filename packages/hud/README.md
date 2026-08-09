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

## License

MIT
