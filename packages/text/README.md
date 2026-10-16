# @weasel-js/text

Typography for weasel: styled runs, style resolution, kerned glyph layout,
wrap and measurement. Glyphs come from
[`@weasel-js/font`](https://www.npmjs.com/package/@weasel-js/font); nothing
here knows about a scene graph, a renderer or React.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/text).

## Install

```sh
npm install @weasel-js/text
```

## Usage

`layoutRuns` is the glyph walk: it takes fully-resolved runs and returns the
lines they wrap into, with every glyph placed. `paintRuns` turns that into what
to draw: the glyphs gathered into groups that share a face and a paint, and the
decoration rules. Paint is read only there, so recoloring text reuses its layout.

```ts
import { toRuns, resolveTextStyle, resolveRuns, layoutRuns, paintRuns } from '@weasel-js/text';

const style = resolveTextStyle({ fontFamily: 'inter', fontSize: 64 });
const runs = resolveRuns(toRuns('Hello'), style);
const laid = layoutRuns(runs, { maxWidth: 900, lineHeight: 1.2, align: 'center' });
const { lines, bounds } = laid;
const { groups, decorations } = paintRuns(laid, runs);
```

A group carries either textured quads (from a baked MSDF atlas) or outline
glyphs — em-space SVG path data plus the pen position, baseline and scale to
place it — for a consumer that tessellates its own geometry. `cachedLayoutRuns`
and `cachedPaintRuns` are the same two calls, memoized.

Metrics come from whichever tier resolved the family: a baked MSDF atlas, or —
for a family registered with `registerFontOutlines` and no atlas — the parsed
face itself, so font bytes alone are enough to lay text out.

The inline grammar `runsToMarkdown` / `markdownToRuns` speak is a parameter,
defaulting to `MARKDOWN_RUN_GRAMMAR` (`**bold**`, `*italic*`, `***both***`).
Pass a `RunGrammar` with different markers to read or write another spelling.
