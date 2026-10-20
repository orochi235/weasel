# @weasel-js/diagram-formats

Turns a `@weasel-js/diagram` scene into files. Today that is one page at a
time, as an SVG document or as a PNG image, each showing the page as the canvas
draws it, cut to the page's edges and on the page's color.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/diagram-formats).

```sh
npm install @weasel-js/diagram-formats
```

## Exporting a page

A page is a rect in world space; a `PlacedPage` from core's `placedPagesOf` is
one. Pages sit apart in one world, and a connector between two pages draws as
two stubs and their off-page tags, so cutting the scene to the page rect leaves
nothing from another page.

```ts
import { placedPagesOf } from '@weasel-js/core';
import { exportPagePng, exportPageSvg } from '@weasel-js/diagram-formats';

const page = placedPagesOf(scene)[0];
const svg = await exportPageSvg(scene, page, { title: 'Page 1' });
const png = await exportPagePng(scene, page, { scale: 2 });
```

Neither writes to the scene, so an export takes no undo entry. Both take
`background`, the color painted under the page: by default the page color of
the scene's diagram theme (`diagram:theme`), and `null` for none.

### SVG

`exportPageSvg` returns the document as a string. Its `viewBox` is the page
rect and its `width` and `height` the page's size. Only nodes whose box meets
the page are written, in paint order, on the scene's visible layers;
annotation layers are left out.

| In the scene | In the SVG |
| --- | --- |
| A shape's outline (`diagram.outline`) | A path of that outline in the shape's box, with its fill and stroke; a container's divider under its header as a second path. A container's members follow inside its group. |
| A connector, or any node that derives its path | One path along the route, with its stroke and its `marker-start` and `marker-end`. A path made of parts writes one path per part. |
| A drawn mark | Its unit-square path stretched over its box. |
| Rows, labels, text marks, and off-page tags | Text, laid out in the lines the canvas lays it into; a tag's background is a rect behind it. |
| Anything else | What `@weasel-js/svg`'s `svgLeafFromKit` writes for it. |

It waits for the paint kinds and font faces the document uses before
writing it. A load that fails goes to `onWarn`, and so does anything SVG cannot
say the way weasel draws it. `title` and `pretty` are passed on to
`serializeSvg`.

`pageSvgNodes(scene, page)` is the walk on its own: the `SvgNode`s, with no
background, for a caller assembling its own document.

### PNG

`exportPagePng` draws the page with core's `renderSceneToPixels`, the renderer
the canvas uses, so its pixels are the canvas's. The image is the page's size
times `scale`, and the result is a `Blob` of type `image/png`. It needs WebGL2
and `OffscreenCanvas`.

Paint kinds and fonts that load on demand are waited for, but the painters are
the caller's to register, as they are to draw the scene at all:

```ts
import { registerDiagramShape, registerMarkShape } from '@weasel-js/diagram';

registerDiagramShape();
registerMarkShape();
```

## Scenes it reads

Poses are read as world-space `RectPose`s, which is what a diagram scene
holds. A scene that composes child poses into a parent's frame is not one.
