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

## Stroke markers

Arrowheads and other line terminators are stroke style — `markerStart`,
`markerMid` and `markerEnd` on `Stroke`, beside `cap` and `dash`, as SVG has
them. They are not a `@weasel-js/diagram` feature because `@weasel-js/svg` has
to round-trip them: living in diagram would either make svg depend on diagram
or lose every diagram edge's head on export.

A stroke names a marker by key — a built-in such as `'arrow'`, or an entry
registered with `registerMarker` from `@weasel-js/core` — and may give it a
size:

```ts
const edge: Stroke = { paint: { color: '#000' }, width: 2, markerEnd: 'arrow' };
const pinned: Stroke = { ...edge, markerEnd: { key: 'arrow', size: { px: 6 } } };
```

An entry's geometry, outline width and inset are all in **marker units**. One
unit is the resolved stroke width, so one entry is right at any line weight.
A `size` replaces the stroke width rather than multiplying it: a number is
world units, and `{ px }` is screen pixels resolved against the view scale at
draw time, as a `{ px }` stroke width is.

### The line stops short of the head

This is where the kit departs from SVG on purpose. SVG paints a marker over a
line that still runs to its endpoint, so a hollow, translucent or narrow head
is speared by its own line, and the usual fix — nudging `refX` — moves the tip
off the thing it points at. Here each entry declares an `inset`, in marker
units, and the stroke stops that far short of each open end while the head
stays on the authored endpoint. It belongs to the shape, not the stroke: a
filled triangle needs its full length or the line shows through, and an open
V needs 0 or its arms stop meeting the line. `markerMid` never trims, and the
trim happens before dashing so the pattern fits the visible line.
