# @weasel-js/diagram-formats

Turns `@weasel-js/diagram` scenes into files and files into scenes. Every
format reads and writes one interchange document, built on the diagram
package's `DiagramData`; and one page at a time exports as an SVG document or
a PNG image, each showing the page as the canvas draws it.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/diagram-formats).

```sh
npm install @weasel-js/diagram-formats
```

## The interchange document

A `DiagramDocument` is a diagram's pages and its theme. Each page has an id,
an optional name, a sheet size, and a `DiagramData` whose places, boxes,
waypoints, and label points run from the page's top-left corner. Ids share one
namespace across the document. Edges whose ends are on different pages sit in
`crossPageEdges`, with no waypoints, since they draw as two stubs and their
off-page tags.

```ts
import { documentFromScene, documentSpecs } from '@weasel-js/diagram-formats';

const doc = documentFromScene(scene);
const { specs, doc: values } = documentSpecs(doc, { layer: 'shapes', measure });
// values holds `core:pages` and `diagram:theme`; replace the scene's nodes with specs.
```

`documentFromScene(scene, { theme })` puts each shape, container, pool, and
group on the page its outermost container overlaps most, or the first page
when it overlaps none; a scene with no pages gets one page around everything.
It keeps the colors the scene's theme would not give: those the author set by
hand (the trait's `ownStyle`) and any that differ from the theme, as `colors`.
A route or a port that layout chose, and an avoiding connector's computed
route, are read as `routed` and `routedPorts`, not as waypoints, so they stay
layout's. `theme` is what colors are compared against when the scene names
none.

`documentSpecs(doc, { layer, theme, measure })` is the way back. Pages are
placed with core's `layoutPages`, as `core:pages` places them. A page where a
node has no `at`, or a pool has no box, is laid out first with `layered`,
running the way its `direction` says, with whatever it places pinned; the
result is kept as places and routes, a page that placed nothing is moved to sit
40 inside its corner, and the page grows to hold it. Then one `diagramScene`
call with no layout draws every page and the edges between them, so no layout
runs again after an import.

## Formats

A `DiagramFormat` has an `id`, a `name`, its `extensions`, and `detect(text)`,
which judges by content alone. `read(text)` returns the document and the
warnings, one sentence each, for what the file had that a diagram cannot hold;
`write(doc, { page })` returns the text and the warnings for what the format
cannot carry. A format with `onePage` writes the page `page` names, else the
first (`writtenPage`).

`DIAGRAM_FORMATS` lists them. `detectFormat(text, fileName)` takes, of the
formats whose `detect` passes, the first claiming the file's extension, else the
first; an extension alone never picks one. `readDocument(text, fileName)` reads
with it and rejects on a file nothing reads.

| Format | Extensions | Reads | Writes |
| --- | --- | --- | --- |
| `DIAGRAM_JSON`, the document as JSON | `.diagram.json` | yes | the whole document |

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
