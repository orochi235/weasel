# @weasel-js/diagram-formats

Turns `@weasel-js/diagram` scenes into files and files into scenes. Every
format reads and writes one interchange document, built on the diagram
package's `DiagramData`. One page at a time exports as an SVG document or a
PNG image, and every page together as one PDF, each showing the page as the
canvas draws it.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/diagram-formats).

```sh
npm install @weasel-js/diagram-formats
```

## The interchange document

A `DiagramDocument` is a diagram's pages and its theme. Each page has an id,
an optional name, a sheet size, and a `kind` saying what it holds. A `'graph'`
page holds a `DiagramData` whose places, boxes, waypoints, and label points run
from the page's top-left corner, and may name its `notation` (`'class'`,
`'state'`, …) for a format that writes graphs in several notations. A `'sequence'`
page holds a `SequenceData` (see `@weasel-js/diagram`), which carries no places:
it is laid out whenever it is drawn, and its `name` is the diagram's title. Ids
share one namespace across the document. Every format lists the page `kinds` it
holds; a writer leaves out a page of another kind with a warning, and
`formatHolds` says whether a format can write a whole document.
`scenePageKinds(scene)` says which kinds a scene would export as from its
top-level nodes alone, and `formatTakes(format, kinds)` whether a format holds
them: what a menu asks on every render. Edges whose ends are on different pages sit in
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
runs again after an import. A sequence page is drawn by `sequenceSpecs` as one
root holding its data, 40 inside its corner, and the page grows to hold it;
`documentFromScene` reads a page holding such a root back as a sequence page and
leaves out its parts.

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
| `DRAW_XML`, draw-style XML | `.xml` | yes, plain or compressed | every page, uncompressed |
| `DIAGRAM_MERMAID`, a Mermaid flowchart | `.mmd`, `.mermaid` | yes | one page |
| `DIAGRAM_DOT`, a Graphviz DOT graph | `.dot`, `.gv` | yes | one page |

Not read, by decision (2026-10-20): packaged office-suite drawing formats,
which are zip archives of many XML parts built on master shapes a scene has no
equivalent for; and SVG, which carries drawn paths rather than shapes and
connectors, so a connector would arrive as a path that follows nothing.

### Draw-style XML

The format that keeps a chart laid out. A file is an `<mxfile>` holding a
`<diagram name=…>` per page, each a graph model of cells; a bare
`<mxGraphModel>` reads as one page. A cell has a `key=value;` style string and
a geometry measured from the corner of the cell holding it. A compressed page
is base64 of raw deflate of the URI-encoded model, so `read` answers a promise.
The file is known by its root element, not its `.xml` extension.

| Diagram | Draw-style XML |
| --- | --- |
| Outline | `rhombus` diamond, `ellipse`, `hexagon`, `parallelogram`, `trapezoid`; `rounded=1` with `arcSize` 50 or more is a stadium; any other shape reads as a rect, with a warning |
| Colors and font | `fillColor` (`none` is transparent), `strokeColor`, `fontColor`, `strokeWidth`, `dashed`; `fontSize`, `fontFamily`, and bold in `fontStyle` as label rows' style |
| Text | `value`; with `html=1`, tags stripped and `<br>` and blocks kept as line breaks. Written plain. |
| Router | `edgeStyle=orthogonalEdgeStyle` orthogonal, `curved=1` bezier, else straight; `avoid` writes as orthogonal along its route |
| Route | the edge geometry's points: `waypoints`, else `routed`, read back as `waypoints` |
| Ports | `exitX`/`exitY` and `entryX`/`entryY`, read as the nearest compass port |
| Edge label | the edge's `value`, or a label cell on it; its geometry `x` (-1 to 1) is where along, `y` how far off the line |
| Arrowheads | `startArrow`/`endArrow` and their `Fill` |
| Container, pool, lane | `container=1` or a `swimlane` is a container; a swimlane whose swimlanes span its body is a pool of lanes, stacked in rows with `horizontal=0` |
| Group | a `group` cell around its members |
| Page | one `<diagram>` each, `pageWidth` and `pageHeight` its size |

Reading leaves a color the style does not name unset, so the chart's theme
draws it. A page grows to hold what is on it, and what sits left of or above it
moves onto it. An id an earlier page used is prefixed with its page's id.
Layers merge into one, and edges with a loose end are left out, each with a
warning.

Writing spells out every color as the document's theme draws it, so the file
looks the same anywhere. A node is written the size it states, which is its
drawn size in a document read from a scene; a page with unplaced nodes is laid
out first, as an import would. Edges between pages are left out, with a
warning, since a page's cells cannot reach another's; so are marks, port rows,
and outline paths, which become rects.

### Mermaid and Graphviz DOT

Both hold a graph's topology and text, not its places (DOT holds them when
every node has a `pos`), so a file reads into one page whose nodes have no
`at`, and `documentSpecs` lays it out the way the page's `direction` says.
Both readers are hand-written and throw an error naming the line on text they
cannot read.

| Diagram | Mermaid flowchart | Graphviz DOT |
| --- | --- | --- |
| rect | `A[text]` | `shape=box` |
| stadium | `A([text])`, and `A(text)` | `shape=box, style=rounded` |
| diamond | `A{text}` | `shape=diamond` |
| ellipse | `A((text))` | `shape=ellipse`, the default, and `circle` |
| hexagon | `A{{text}}` | `shape=hexagon` |
| parallelogram | `A[/text/]` | `shape=parallelogram` |
| trapezoid | `A[/text\]` | `shape=trapezium` |
| edge and label | `A -->\|text\| B`, `A -- text --> B` | `A -> B [label=…]` |
| no arrowhead, dashed, thick | `---`, `-.->`, `==>` | `dir`, `arrowhead`, `style=dashed`, `penwidth` |
| container | `subgraph` | `subgraph cluster_*` |
| page name | front matter `title` | the graph's `label`, else its name |
| page `direction` | `flowchart TD/LR/BT/RL` | `rankdir` |
| colors | `classDef`, `class`, `:::`, `style`, `linkStyle` | `fillcolor` with `style=filled`, `color`, `fontcolor` |
| ports | — | `node:compass`, `n`, `e`, `s`, and `w` only |

A Mermaid shape with no outline here reads as a rect, with a warning; a
Mermaid diagram of another kind is refused with an error naming the kind. DOT
reads its whole grammar: `strict`, `graph` and `digraph`, attribute
statements and their scoping, edge chains, and subgraphs as edge ends. Its
HTML labels read as their text, and the attributes it does not read are
listed in one warning. A cluster's container drops its `cluster_` prefix when
that id is free.

Writing, each writes the theme's colors once (Mermaid's `classDef default`,
DOT's `node` and `edge` defaults) and each item's own where they differ. DOT
writes every node's `pos`, `width`, and `height` when each has a place and a
size, so a DOT file read back keeps the layout. Pools, lanes, and groups are
written as nested clusters or subgraphs and read back as containers. Mermaid
ids that are keywords or not plain names are renamed, keeping their text.
Bends, connectors to other pages, drawn outlines, and ports a format lacks
are dropped with a warning.

### Mermaid sequence diagrams

A `sequenceDiagram` reads into one sequence page, and a sequence page writes
back as one. The reader throws an error naming the line on what it cannot read,
including an `end` that closes nothing and a fragment never closed.

| Sequence | Mermaid |
| --- | --- |
| participant and label | `participant A as Text`, `actor A` |
| outline | `participant A@{ "type" : "boundary" }`: `boundary`, `control`, `entity`, `database` (the cylinder), `collections`, `queue` |
| message `line`, `head`, `both` | `->`, `-->`, `->>`, `-->>`, `-x`, `--x`, `-)`, `--)`, `<<->>`, `<<-->>` |
| `activate: 'to'`, `deactivate: 'from'` | `A->>+B`, `B-->>-A` |
| activate, deactivate | `activate A`, `deactivate A` |
| note | `Note left of A`, `Note right of A`, `Note over A,B` |
| fragment | `loop`, `alt`/`else`, `opt`, `par`/`and`, `critical`/`option`, `break`; `rect <color>` is a `region` |
| box | `box <color> Label` … `end` |
| create, destroy | `create participant B`, `destroy B` |
| `autonumber` | `autonumber`, `autonumber 10` |
| page name | `title`, or the front matter's `title` |

A participant a message or note names before any declaration is added in the
order it is first named. Configuration, accessibility text, participant menus
(`link`, `links`, `properties`, `details`), and an autonumber step other than 1
are dropped with a warning. Writing, colors and roles on participants and
fragments, a region's label, and a second head on a message whose head is not
an arrow are dropped with a warning; an activation Mermaid has no shorthand for
is written as its own `activate` or `deactivate` line.

## Exporting a page

A page is a rect in world space; a `PlacedPage` from core's `placedPagesOf` is
one. Pages sit apart in one world, and a connector between two pages draws as
two stubs and their off-page tags, so cutting the scene to the page rect leaves
nothing from another page.

```ts
import { placedPagesOf } from '@weasel-js/core';
import { exportPagePng, exportPageSvg, exportPagesPdf } from '@weasel-js/diagram-formats';

const pages = placedPagesOf(scene);
const svg = await exportPageSvg(scene, pages[0], { title: 'Page 1' });
const png = await exportPagePng(scene, pages[0], { scale: 2 });
const { blob, skipped } = await exportPagesPdf(scene, pages, { title: 'Chart' });
```

None writes to the scene, so an export takes no undo entry. Each takes
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

### PDF

`exportPagesPdf` writes each of `pages` as a page of one PDF, in the order
given, at 0.75 points per unit (96 units to the inch). It answers the `Blob`,
of type `application/pdf`, and `skipped`: what the PDF could not carry, each a
`{ kind, detail }` from `@weasel-js/pdf`. Annotation layers are left out.

Shapes and strokes are written as vectors and text as selectable text in its
embedded face, which needs the face's outlines registered from a TrueType file
(`registerFontOutlines` in `@weasel-js/font`). A face that cannot be embedded
is drawn as glyph outlines, so its text is not selectable; a glyph with no
outline at all is left out and listed in `skipped`.

Effects, custom shaders, and fills in a registered paint kind are drawn through
the renderer and placed as images, so the painters are the caller's to
register, as for the PNG, and this needs WebGL2 and `OffscreenCanvas`.

## Scenes it reads

Poses are `RectPose`s. A child stores its pose in its parent's frame, and both
the reader and the page exports fold it through that frame, so each sees a node
where the canvas draws it.
