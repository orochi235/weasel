# @weasel-js/paint

Paint vocabulary for weasel: `FillStyle`, `Stroke`, gradients, dashes. Plain
data — nothing here draws anything.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/api/).

## Install

```sh
npm install @weasel-js/paint
```

## Usage

```ts
import type { FillStyle, Stroke } from '@weasel-js/paint';

const fill: FillStyle = { color: '#c0ffee' };
const stroke: Stroke = { paint: { color: '#000' }, width: 2, join: 'round' };
```
