# @weasel-js/pdf

PDF documents from weasel draw commands: vector paths, shadings, images, and
embedded fonts with selectable text. No scene graph, no React.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/pdf).

## Install

```sh
npm install @weasel-js/pdf
```

## Usage

```ts
import { writePdf } from '@weasel-js/pdf';

const { bytes, skipped } = await writePdf(
  [{ width: 612, height: 792, commands }],
  { fonts, title: 'Chart' },
);
```

Page units are points, with the origin at the top left and y growing downward.

## What is drawn

Written natively, as vectors: paths, solid fills, gradient shadings (with soft
masks for transparency), strokes (native, or outlined where PDF cannot express
them) with their markers, images, sprites, tiling patterns, text as Type0 fonts
with a ToUnicode map, color matrices, and isolated groups.

Handed to the `rasterize` hook: effects groups and shader commands. Without a
hook they are skipped.

```ts
rasterize(commands, rect, scale, view) => Promise<{ width, height, data }>
```

`rect` is the region in page points, `scale` the pixels per point, and `view`
the page's `view`, which `world`-unit paint in `commands` resolves through.
`data` is straight RGBA, top-down.

A face that is CFF-only, restricted (`fsType` 0x0002), or unreadable is drawn
as glyph outlines instead, so its text is not selectable.

## `skipped`

Each entry is `{ kind: 'glyph' | 'command', detail }`. It reports:

- an effects group or shader command with no `rasterize` hook, or one whose hook threw or returned the wrong number of pixels;
- an image that could not be read, and a texture that cannot be drawn;
- a glyph the face has no outline for, in the outline fallback;
- the approximations below, except the stroke width.

## Known approximations

- A `{ px }` stroke width under an anisotropic view uses the mean scale.
- A `vertexColors` stroke uses a single paint.
- A Porter-Duff composite is drawn source-over.
- An isolated group's color matrix alpha offset is not drawn.
