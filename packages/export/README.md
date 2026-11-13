# @weasel-js/export

Exports a page of any `@weasel-js/core` scene as a file: one page as an SVG
document or a PNG image, and every page together as one PDF, each showing the
page as the canvas draws it. It reads nothing but the scene, so an editor of
any kind exports through it. `@weasel-js/diagram-formats` builds its page
exports on it, adding the diagram painters and the diagram theme's page color.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/export).

```sh
npm install @weasel-js/export
```

## Exporting a page

A page is a rect in world space; a `PlacedPage` from core's `placedPagesOf` is
one. The scene's poses are `RectPose`s, a child's in its parent's frame; the
exports fold each through that frame, so each node is written where the canvas
draws it.

```ts
import { placedPagesOf } from '@weasel-js/core';
import { exportPagePng, exportPageSvg, exportPagesPdf } from '@weasel-js/export';

const pages = placedPagesOf(scene);
const svg = await exportPageSvg(scene, pages[0], { title: 'Page 1', background: '#ffffff' });
const png = await exportPagePng(scene, pages[0], { scale: 2, background: '#ffffff' });
const { blob, skipped } = await exportPagesPdf(scene, pages, { title: 'Drawing', background: '#ffffff' });
```

Each draws the document, not what an open gesture or edit is showing, and none
writes to the scene, so an export takes no undo entry. Annotation layers are
left out. `background` is the color painted under the page; by default none is,
since core holds no page color of its own.

### SVG

`exportPageSvg` returns the document as a string. Its `viewBox` is the page
rect and its `width` and `height` the page's size. Only nodes whose box meets
the page are written, in paint order, on the scene's visible layers.

| In the scene | In the SVG |
| --- | --- |
| A node a consumer painter claims | That painter's paths, with their fills and strokes. The painter is the first of `painters` to claim the node, else the one `registerNodeShape` registered. |
| A connector, or any node that derives its path | One path along the route, with its stroke and its `marker-start` and `marker-end`. A path made of parts writes one path per part. |
| Anything else, the kit's own shapes, paths, text and images included | What `@weasel-js/svg`'s `svgLeafFromKit` writes for it. |

`painters` is for a kind the scene draws with a painter it may not have
registered, as `@weasel-js/diagram-formats` passes the diagram outlines. A
painter's path commands are written; anything else it draws is not.

It waits for the paint kinds and font faces the document uses before
writing it. A load that fails goes to `onWarn`, and so does anything SVG cannot
say the way weasel draws it. `title` and `pretty` are passed on to
`serializeSvg`.

`pageSvgNodes(scene, page, { painters })` is the walk on its own: the
`SvgNode`s, with no background, for a caller assembling its own document.

### PNG

`exportPagePng` draws the page with core's `renderSceneToPixels`, the renderer
the canvas uses, so its pixels are the canvas's. The image is the page's size
times `scale`, and the result is a `Blob` of type `image/png`. It needs WebGL2
and `OffscreenCanvas`. Paint kinds and fonts that load on demand are waited
for, but the painters are the caller's to register (`registerNodeShape`), as
they are to draw the scene at all.

### PDF

`exportPagesPdf` writes each of `pages` as a page of one PDF, in the order
given, at 0.75 points per unit (96 units to the inch). It answers the `Blob`,
of type `application/pdf`, and `skipped`: what the PDF could not carry, each a
`{ kind, detail }` from `@weasel-js/pdf`.

Shapes and strokes are written as vectors and text as selectable text in its
embedded face, which needs the face's outlines registered from a TrueType file
(`registerFontOutlines` in `@weasel-js/font`). A face that cannot be embedded
is drawn as glyph outlines, so its text is not selectable; a glyph with no
outline at all is left out and listed in `skipped`.

Effects, custom shaders, and fills in a registered paint kind are drawn through
the renderer and placed as images, so the painters are the caller's to
register, as for the PNG, and this needs WebGL2 and `OffscreenCanvas`.
