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
it is laid out whenever it is drawn, and its `name` is the diagram's title. A
`'plot'` page holds one chart, a `PlotData` from `@weasel-js/plot`, which fills
the page. Ids share one namespace across the document. Every format lists the
page `kinds` it holds; a writer leaves out a page of another kind with a
warning, and `formatHolds` says whether a format can write a whole document.
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
layout's. An edge's end labels read back as `endLabels`, and a `field` row as
a field while its text still starts with its label. `theme` is what colors are
compared against when the scene names none. A page holding a plot root (one
`plotSpecs` made) is a plot page of the spec the root holds, edits included;
anything else on that page is left out. A graph page takes the `notation`, `layout`, and
`direction` its `core:pages` page keeps under `meta['diagram:graph']`
(`GRAPH_PAGE_META_KEY`, read with `graphPageSettingsOf`), where `documentSpecs`
writes them.

`documentSpecs(doc, { layer, theme, measure })` is the way back. Pages are
placed with core's `layoutPages`, as `core:pages` places them. A page where a
node has no `at`, or a pool has no box, is laid out first with the layout its
`layout` names (`{ name, options }`, a key of `LAYOUTS`, default `layered`), running the way its `direction` says, with whatever it places pinned; the
result is kept as places and routes, a page that placed nothing is moved to sit
40 inside its corner, and the page grows to hold it. Then one `diagramScene`
call with no layout draws every page and the edges between them, so no layout
runs again after an import. A sequence page is drawn by `sequenceSpecs` as one
root holding its data, 40 inside its corner, and the page grows to hold it;
`documentFromScene` reads a page holding such a root back as a sequence page and
leaves out its parts. A plot page is one plot root filling the page, its
id `<page id>/plot`, its marks under it, drawn in the theme's roles: text in the
label color, axes in the connector stroke, grid lines in the container stroke,
series in the theme's `series` (`plotThemeOf`).

A graph page with no `notation` of its own takes the one its scene's diagram type writes (`diagramNotationOf`), and
`documentSpecs` sets `diagram:type` when every graph page's notation names one type, so an imported class diagram
opens with the UML stencils.

`PAGE_TEMPLATES` holds a new page of every kind: an empty graph page per diagram type, in its notation; a small
sequence diagram; and a small chart of each plot kind, each with the `group` a menu lists it under. `templateSpecs`
draws one as a new one-page document, the diagram type it names included, and `addTemplatePage(scene, template)`
adds one as another page, what it draws with it, as one undo entry. `pageSpecs` draws any one page placed where a
page list would place it.

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
| `DIAGRAM_JSON`, the document as JSON | `.diagram.json` | yes, graph and plot pages | the whole document |
| `DRAW_XML`, draw-style XML | `.xml` | yes, plain or compressed | every page, uncompressed |
| `DIAGRAM_MERMAID`, a Mermaid flowchart, class, state, ER, mind map, requirement, block, architecture, C4, kanban, or sequence diagram, or a chart | `.mmd`, `.mermaid` | yes | one page, a graph, a sequence, or a chart |
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
| Outline | `rhombus` diamond, `ellipse`, `hexagon`, `parallelogram`, `trapezoid`; `startState`, `endState`, and `line` as `start`, `end`, and `bar`; `rounded=1` with `arcSize` 50 or more is a stadium; any other shape reads as a rect, with a warning |
| Colors and font | `fillColor` (`none` is transparent), `strokeColor`, `fontColor`, `strokeWidth`, `dashed`; `fontSize`, `fontFamily`, and bold in `fontStyle` as label rows' style |
| Text | `value`; with `html=1`, tags stripped and `<br>` and blocks kept as line breaks. Written plain. |
| Router | `edgeStyle=orthogonalEdgeStyle` orthogonal, `curved=1` bezier, else straight; `avoid` writes as orthogonal along its route |
| Route | the edge geometry's points: `waypoints`, else `routed`, read back as `waypoints` |
| Ports | `exitX`/`exitY` and `entryX`/`entryY`, read as the nearest compass port |
| Edge label | the edge's `value`, or a label cell on it; its geometry `x` (-1 to 1) is where along, `y` how far off the line. A label cell at `x` -1 or 1 is an end label (`endLabels`) |
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
| end labels | — | `taillabel`, `headlabel` |
| no arrowhead, dashed, thick | `---`, `-.->`, `==>` | `dir`, `arrowhead`, `style=dashed`, `penwidth` |
| container | `subgraph` | `subgraph cluster_*` |
| page name | front matter `title` | the graph's `label`, else its name |
| page `direction` | `flowchart TD/LR/BT/RL` | `rankdir` |
| colors | `classDef`, `class`, `:::`, `style`, `linkStyle` | `fillcolor` with `style=filled`, `color`, `fontcolor` |
| ports | — | `node:compass`, `n`, `e`, `s`, and `w` only |

A Mermaid shape with no outline here reads as a rect, with a warning. DOT
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

### Mermaid's other kinds

`DIAGRAM_MERMAID` reads a diagram by its header and sets the page's `notation`
to the kind it read; it writes a graph page in the kind its `notation` names,
and as a flowchart when it names none (or one Mermaid has not, with a
warning). Every kind reads front matter's `title` as the page name (else
`accTitle`), skips `%%` comments, and drops `%%{…}%%` directives and
`accDescr` with a warning. A Mermaid kind not read here (`zenuml`,
`treemap`, …) is refused with an error naming it. Each reader throws an error
naming the line on text it cannot read, and warns of what it drops.

`classDiagram`, notation `'class'`:

| Mermaid | Diagram |
| --- | --- |
| `class A`, `class A~T~`, `class A["Label"]` | a box: `<<annotation>>` rows, the name row (`A<T>`), a divider, attribute rows, a divider, method rows |
| members in `class A { … }`, or `A : +member` | a member with parentheses is a method |
| `<<interface>> A`, or inside the braces | an annotation row |
| `<\|--` `*--` `o--` `-->` `--` | `triangle-hollow`, `diamond`, `diamond-hollow`, `arrow`, none, at the end the head is on |
| `..>` `..\|>` `..` | dashed, with `arrow-open`, `triangle-hollow`, none |
| `A "1" --> "*" B : label` | `endLabels` `{ from: '1', to: '*' }`, and the label |
| `namespace N { … }` | a container |
| `note "text"`, `note for A "text"` | a `note` shape, joined to `A` by a dashed unmarked edge |
| `direction LR` | the page's `direction` |
| `style`, `classDef`, `cssClass`, `:::` | colors |

`stateDiagram-v2` and `stateDiagram`, notation `'state'`:

| Mermaid | Diagram |
| --- | --- |
| `A`, `state "Name" as A`, `A : description` | a `roundRect` with the name, then each description, as lines |
| `[*]` | a `start` where a transition leaves it and an `end` where one arrives, one each per scope |
| `state A <<fork>>`, `<<join>>`, `<<choice>>` | a `bar` across the way the page runs, and an empty diamond |
| `A --> B : label` | an edge and its label |
| `state X { … }` | a container; divided by `--` into concurrent regions, a pool with a lane per region |
| `note right of A : text`, `note left of A … end note` | a `note` shape joined to `A`; the side is dropped |
| `classDef`, `class`, `:::` | colors |

`erDiagram`, notation `'er'`:

| Mermaid | Diagram |
| --- | --- |
| `A`, `A["Label"]` | a box of its name row |
| `A { type name PK, FK "comment" }` | a divider, then a `field` row per attribute: the type as its label; the name, keys, and comment as its value |
| `\|o` `\|\|` `}o` `}\|` (and mirrored) | `crow-zero-one`, `crow-one`, `crow-zero-many`, `crow-one-many` at that end |
| `--`, `..` | solid, dashed |
| `A \|\|--o{ B : label` | the label |
| `style`, `classDef`, `class` | colors |

`mindmap`, notation `'mindmap'`:

| Mermaid | Diagram |
| --- | --- |
| an indented line | a node, joined to the line it is indented under by an unmarked edge |
| `text`, `id[text]`, `id(text)`, `id((text))`, `id))text((`, `id)text(`, `id{{text}}` | no outline of its own, `rect`, `roundRect`, `ellipse`, `cloud`, `cloud`, `hexagon` |
| no id | `n` and its place in the file: `n2`, `n3`, … |
| the whole map | laid out by `radial`, the root in the middle and its branches to both sides (the page's `layout`) |
| `::icon(…)`, `:::class` | dropped, with a warning |

`requirementDiagram`, notation `'requirement'`:

| Mermaid | Diagram |
| --- | --- |
| `requirement name { … }`, its five other kinds, and `element name { … }` | a box: a `<<kind>>` row, the name row, a divider, a `field` row per `key: value` |
| `a - satisfies -> b`, `b <- satisfies - a` | a dashed arrow from `a` to `b` labeled `<<satisfies>>` |
| `style`, `classDef`, `class` | colors |

`block-beta`, notation `'block'`, laid out by `grid` (the page's `layout`):

| Mermaid | Diagram |
| --- | --- |
| `a`, `a["text"]`, and the flowchart's other brackets | a node: its text (else its id) in the flowchart's outline for those brackets |
| `columns 3` | the grid's `columns`, or a group's under `groupColumns`; `columns auto` leaves it unset |
| `a:2`, `block:g:2` | `spans` |
| `space`, `space:2` | `skips` on the next block; spaces after a level's last block are dropped, with a warning |
| `block:g … end`, `block … end` | a container holding its blocks in order; an unnamed one is `block-1`, `block-2`, … |
| `a --> b`, `a --- b`, `a -.-> b`, `a ==> b`, `a <--> b`, `a -- "text" --> b` | an edge: its heads, dashed or 3 wide, and its label |
| `style`, `classDef`, `class` | colors |
| `a<["text"]>(right)` | a rect, its direction dropped with a warning |

`architecture-beta`, notation `'architecture'`, laid out running right:

| Mermaid | Diagram |
| --- | --- |
| `service a(icon)[Title] in g` | a node of its title (else its id): `cloud`, `database`, `disk`, `internet`, and `server` as the `cloud`, `cylinder`, `disk`, `globe`, and `server` outlines; no icon, or any other with a warning, as `roundRect` |
| `junction j in g` | a 12-wide `start` dot with no text |
| `group g(icon)[Title] in parent` | a container titled with its title; its icon is dropped with a warning |
| `a:R --> L:b`, `--`, `<--`, `<-->` | an edge leaving `a`'s `e` port and meeting `b`'s `w` (`L`, `R`, `T`, `B` as `w`, `e`, `n`, `s`), with its heads |
| `a{group}:R --> L:b` | an edge from `a`'s group, meeting its box where layout chooses |

`C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, and `C4Deployment`, notations `'c4-context'` through `'c4-deployment'`:

| Mermaid | Diagram |
| --- | --- |
| `Person`, `System`, `Container`, `Component`, their `Db` and `Queue` kinds, and each one's `_Ext` | a node 200 wide: a `<<kind>>` row (`<<external_system_db>>`), its name in bold, a container's or component's `[technology]`, and its description wrapped; outline `person`, `cylinder`, `queue`, or `roundRect`; role `muted` when external, else `accent` |
| `Enterprise_Boundary`, `System_Boundary`, `Container_Boundary`, `Boundary`, `Deployment_Node`, `Node` | a container titled `Name [enterprise]`, `[system]`, `[container]`, or the type it gives |
| `Rel(a, b, "label", "technology")`, `BiRel`, `Rel_Back` | an edge labeled `label [technology]`; heads at both ends; a head at `a` only |
| `Rel_U`, `Rel_D`, `Rel_L`, `Rel_R` | ports: `n` to `s`, `s` to `n`, `w` to `e`, `e` to `w` |
| `UpdateElementStyle(a, $bgColor, $fontColor, $borderColor)`, `UpdateRelStyle(a, b, $textColor, $lineColor)` | colors |
| `title` | the page name |
| sprites, tags, links, a relationship's description, offsets, and layout settings | dropped, with a warning |

Written back, a box with no `<<kind>>` row is a system, a person, store, or queue by its outline, and external when its role is `muted`.

`kanban`, notation `'kanban'`:

| Mermaid | Diagram |
| --- | --- |
| the board | one pool, `board`, whose lanes run along `x`, sized to hold its longest column |
| `todo[Todo]`, a line at the shallowest indent | a lane 220 wide; one with no id is `column-` and its place |
| `id[text]`, a line indented under it | a node 180 wide in that lane: its text wrapped into rows; one with no id is `card-` and its place |
| `@{ ticket: MC-1, assigned: 'kim', priority: 'High' }` | a `field` row per pair |

Writing a kind writes what its reader reads, so text read and written reads
back as the same page. A page from elsewhere writes as near as the kind
allows, with a warning for each thing it cannot carry: an end a class diagram
has no head for is an arrow, one an ER diagram has no crow's foot for is
exactly one, an unlabeled relationship is `traces`, and a mind map keeps the
first root's tree.
### Mermaid xychart

`xychart-beta`, or `xychart`, reads onto one 800 by 500 plot page holding an
`xychart` (`readMermaidXychart`), and a plot page holding one writes back as
`xychart-beta` (`writeMermaidXychart`). Errors name the line.

| `XyChartData` | Mermaid |
| --- | --- |
| `orientation: 'horizontal'` | `xychart-beta horizontal` |
| `title`, and the page name | `title "…"`, else the front matter's `title` |
| `x`, a band axis | `x-axis "title" [a, "b c"]` |
| `x`, a range axis | `x-axis "title" 1 --> 10` |
| `y` | `y-axis "title" 0 --> 100`; one end alone is dropped on writing, with a warning |
| a series | `bar "name" [1, 2]`, `line [1, 2]` |

Reading drops other front matter, `%%{init}%%` directives, `accTitle` and
`accDescr`, with a warning each, and warns of values past the last category.

### Mermaid charts

Each of these reads onto one plot page holding the chart kind named, and a
plot page holding that kind writes back as it; the writer picks the Mermaid
kind from the chart's kind. Each reader names the line of an error (a score
out of range, a field that overlaps another, a checkout of a branch that does
not exist) and warns of what it drops; each writer warns of what Mermaid
cannot hold.

| Mermaid | Chart | What is read |
| --- | --- | --- |
| `gantt` | `gantt` | `title`, `dateFormat`, `axisFormat`, `excludes`, `todayMarker`, `section`; tasks `Name :tags, id, start, end` with `done`/`active`/`crit`/`milestone`, a start that is a date or `after a b`, an end that is a date, a duration (`3d`, `2w`, `5h`, `1M`, …) or `until a`, each kept as written |
| `timeline` | `timeline` | `title`, `section`, `period : event : event`, and `: event` lines continuing the period above |
| `pie` | `pie` | `pie showData title …`, `title`, `"label" : value` |
| `quadrantChart` | `quadrant` | `title`, `x-axis Low --> High`, `y-axis`, `quadrant-1` to `quadrant-4`, points `Name: [x, y]` with `:::class` and `radius`, `color`, `stroke-color`, `stroke-width`, `classDef` |
| `journey` | `journey` | `title`, `section`, `Task: score: Actor, Actor` |
| `gitGraph` | `gitgraph` | `gitGraph LR:`/`TB:`/`BT:`, `commit` (`id`, `type`, `tag`, `msg`), `branch` (`order`), `checkout`/`switch`, `merge` (`id`, `type`, `tag`), `cherry-pick` (`id`, `tag`, `parent`); the title from front matter |
| `sankey-beta` | `sankey` | CSV `source,target,value` lines, quoted as CSV quotes; the title from front matter |
| `packet-beta` | `packet` | `title`, `0-15: "label"`, `16: "label"`, `+8: "label"` |
| `radar-beta` | `radar` | `title`, `axis a["Label"], b`, `curve c["Label"]{1, 2}` and `curve c{ a: 1, b: 2 }`, `max`, `min`, `graticule`, `ticks`, `showLegend` |

Dropped on reading, with a warning: Gantt `click`, `call`, `inclusiveEndDates`,
`topAxis`, `tickInterval`, `weekday`, `displayMode`, and `vert` tasks; a
timeline's direction; configuration such as a packet's bits per row or a git
graph's main branch name. Gantt dates are read and written in UTC.

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
| A plot's mark | Its path or its text, in the plot root's frame. |
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
