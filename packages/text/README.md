# @weasel-js/text

Typography for weasel: styled runs, style resolution, kerned glyph layout,
wrap and measurement. Glyphs come from
[`@weasel-js/font`](https://www.npmjs.com/package/@weasel-js/font); nothing
here knows about a scene graph, a renderer or React.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/api/).

## Install

```sh
npm install @weasel-js/text
```

## Usage

`layoutRuns` is the glyph walk: it takes fully-resolved runs and returns
positioned geometry, grouped so that one group is one draw call.

```ts
import { toRuns, resolveTextStyle, resolveRuns, layoutRuns } from '@weasel-js/text';

const style = resolveTextStyle({ fontFamily: 'inter', fontSize: 64 });
const { groups, lines, bounds } = layoutRuns(resolveRuns(toRuns('Hello'), style), {
  maxWidth: 900,
  lineHeight: 1.2,
  align: 'center',
});
```

A group carries either textured quads (from a baked MSDF atlas) or outline
glyphs — em-space SVG path data plus the pen position, baseline and scale to
place it — for a consumer that tessellates its own geometry.

Metrics come from whichever tier resolved the family: a baked MSDF atlas, or —
for a family registered with `registerFontOutlines` and no atlas — the parsed
face itself, so font bytes alone are enough to lay text out.
