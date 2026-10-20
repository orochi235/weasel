# weaselchart (`apps/chart`), third arc — design

**Unbuilt as of 2026-10-20.**

For whoever builds each piece of the third arc. For each piece it says what the user does and sees
in weaselchart, which engine surface the piece adds and where, how it saves and undoes, how it
meets the second arc's code, and which tests prove it. Read `CLAUDE.md` ("Scope", "What gets its
own package", "Module shape", "Terminology") and `docs/taxonomy.md` first; this doc does not
restate them.

The first two arcs are merged and their specs deleted (readable at
`git show 89e332f4d:docs/superpowers/specs/2026-10-19-chart-app-design.md` and
`git show e9f49874d:docs/superpowers/specs/2026-10-19-chart-arc-2-design.md`). Their rules hold:
every editing ability is engine surface in `@weasel-js/diagram` or core, each editing action has a
swappable commit (scene ops by default, a report for a data-backed host such as `DiagramView` or
`EffectEditor`), and the app only proves it. labkit will reuse all of it.

## Build order

Each piece lands in its own worktree and merges on its own green `npm run test:fleet` and
`npm run test:gate`. A wave's pieces are built in parallel; a piece starts once what it needs has
merged.

| # | Piece | Package | Needs | Wave |
|---|---|---|---|---|
| 10 | Theme builder | core, diagram, app | — | 1 |
| 4 | Edge labels as obstacles, and labels that dodge | diagram, app | — | 2 |
| 6 | Exporting one page | new `diagram-formats`, app | merges after 3 | 2 |
| 7 | Containers and swimlanes in `DiagramData` | diagram | — | 2 |
| 9 | Pipeline groups as editable containers | diagram, app | 7 | 3 |
| 12 | Interchange document model | `diagram-formats`, diagram, app | 6, 7 | 3 |
| 13 | Mermaid and Graphviz DOT | `diagram-formats`, app | 12 | 4 |
| 14 | Draw-style XML | `diagram-formats`, svg, app | 12 | 4 |

Pieces are numbered by topic; build them by wave. Piece 6 needs nothing from piece 3 to compile,
so it is built alongside it, but a page export is only right once cross-page connectors stop
drawing across the gap, so it merges second.

Shared files, and who makes room in them first:

| File | Lines now | Touched by | Split first, by |
|---|---|---|---|
| `packages/diagram/src/edge.ts` | 218 | 3 | done: the four routers are in `routers.ts` |
| `packages/diagram/src/fromData.ts` | 386 | 7, 12 | piece 7: the data types move to `dataTypes.ts`, re-exported |
| `packages/diagram/src/effect/EffectEditor.tsx` | 154 | 9, 11 | done: `editHandlers` moved to `effect/editorHandlers.ts` |
| `packages/diagram/src/diagramViewProps.ts` | 185 | 4, 7 | none needed; each adds props |

Every piece also: writes `patch` changesets; keeps files under 400 lines and functions under 120
(`npm run check:size`); exports only public surface to the app; updates the diagram README and
`docs/TODO.md`'s weaselchart entry in its merge; and deletes its own section of this doc when it
merges (the doc goes with the last piece). Points, offsets, and boxes here are `Vec2` and plain
boxes on purpose: everything in this arc lives on the page plane, and kernel3d hosts route no
connectors (the second arc's call, kept).


## 4. Edge labels as obstacles, and labels that dodge

### What the user sees

Connectors routed around shapes also route around other connectors' labels. After any edit, a
label that would sit on a shape, on another label, or on another connector slides along its own
connector, or flips to the other side of it, to the nearest clear spot. Labels do not move during
a drag; they settle on release, in the same undo entry.

### Labels as obstacles (`packages/diagram/src/avoid/`)

- `types.ts`: `AvoidEdge.label?: { id: string; placement: DiagramLabel; size: { width; height } }`;
  `AvoidOptions.labelClearance` (default 4). `blocks(obstacle, edge)` takes the edge, so a label
  blocks every connector but its own; `ObstacleIndex.forEdge(edge)` likewise.
- `router.ts`: the router files each label as an obstacle from its edge's current route with
  `labelCenter`. Within one commit, once a connector is routed its label is restationed on the new
  route and refiled before the next connector routes.
- `sceneInput.ts` fills `label` from each edge's label node; `specRoutes.ts` does the same from
  label specs, so `DiagramView router="avoid"` gets it too.

The obstacle table's "An edge label: never" row becomes "always, except to its own connector".

### Labels that dodge (`packages/diagram/src/labels/`)

- `labelTrait.ts`: `DiagramLabel.placed?: { at: number; offset: number }`, owned by placement, and
  `dodge?: false` to opt out. `labelDerivePose` reads `placed` before `at` and `offset`, which stay
  the author's preference.
- `place.ts`, pure, exported from `@weasel-js/diagram/layout`:
  `placeLabels(input, opts) → Map<labelId, { at; offset }>`. For each moving label it tries the
  preferred station, then stations a label-width-plus-8 apart along the route on either side, up to
  four each way, each on both sides of the line. It scores each candidate by area over shapes ×1000,
  over labels already placed ×100, routes it covers ×10, plus the distance slid; it keeps the lowest,
  and placed labels become obstacles for the next. Labels go in id order, so the answer is
  deterministic.
- `install.ts`: `installLabelPlacement(scene)` and `useLabelPlacement(scene)`, an edit pass at
  `DIAGRAM_PASS_ORDER.labels`. The moving set is the labels of edges with changed data or moved
  ends, new labels, and labels whose box meets a changed shape, route, or moving label.
- `specLabels.ts`: `createSpecLabelPlacer()`; `DiagramView` takes `labels?: 'dodge'`, run after the
  spec router.

**Decision (2026-10-20).** Route first, then place: routes avoid labels as they stand, then labels
move off the new routes. One round each, so an edit's cost is bounded; anything left touching
settles on the next edit.

### Works with

Layered layout's label room (`at: { near }`) is the preferred station, so a laid-out diagram's
labels stay where layout put them unless something covers them. A label on a split edge (piece 3)
is placed on the first stub.

### Performance budget

Measured by `packages/diagram/src/labels/labels.bench.ts` on the fleet (`--kind bench`), printing
each case as it finishes.

| Case | Diagram | Budget |
|---|---|---|
| Commit | 200 shapes, 300 labeled connectors, 40 moving | 8 ms |
| Full placement | same, all moving | 40 ms |
| Avoid commit with labels | the second arc's commit case, labeled | its 30 ms budget, unchanged |

### Tests

- `place.test.ts`: clear preferred station kept; slides off a shape; flips sides; two labels on
  parallel connectors separate; deterministic.
- `search.test.ts`: a route avoids another connector's label and not its own.
- `labels.scene.test.ts`: a move that covers a label re-places it in the move's entry; undo restores
  `placed`; `dodge: false` never moves.
- `DiagramView.labels.test.tsx`; chart browser test: drag a shape onto a label, release, the label's
  pixels clear the shape.

## 6. Exporting one page

### What the user sees

File › Export › Page as SVG… and Page as PNG (1×, 2×, 4×) download the page the view shows (the
first page when the view is between pages), cut to the page's edges, on the page color. A
cross-page connector shows as its stub and tag (piece 3).

### Engine surface: new package `@weasel-js/diagram-formats` (`packages/diagram-formats/`)

It owns converting diagrams to and from files: an obviously well-defined functional area, and it
depends on `@weasel-js/svg`, which `@weasel-js/diagram` does not. Peer dependencies: core, diagram,
svg. It joins the changesets `fixed` group, is laid out like `packages/diagram-elk`, and needs its
first npm publish seeded by hand.

- `pageSvg.ts`: `exportPageSvg(scene, page, opts?) → Promise<string>`. It walks the nodes whose box
  meets the page through `@weasel-js/svg`'s `svgNodesFromKit` (`fromKit.ts`), with a diagram leaf
  lowering: outlines through `outline.ts`'s path for the box, edges from `derivedDepOf(scene, id)
  .path` with their stroke and markers, marks from their unit-square paths and text points. Any
  other leaf goes to `svgLeafFromKit`. `viewBox` is the page rect; a background rect in the theme's
  `page` color comes first.
- `pagePng.ts`: `exportPagePng(scene, page, { scale, background? }) → Promise<Blob>` through core's
  `renderSceneToPixels`, put into an `OffscreenCanvas` and encoded with `convertToBlob`. The caller
  has registered the diagram painters (`registerDiagramShape`, `registerMarkShape`) and fonts, as
  it must to draw at all.

**Decision (2026-10-20).** A page export is the scene clipped to the page rect: pages sit apart in
one world, and once cross-page connectors draw as stubs, nothing on one page reaches another.

App: `apps/chart/src/exportCommands.ts` registers the commands with `useChartPages`' `current` and
`downloadBlob` (`apps/shared/editor/src/fileIO.ts`).

An export reads the scene and writes nothing, so it has no history entry. Hops (`diagram.hops`), placed
labels (piece 4), and stored routes are in the scene, so the export draws them as the canvas does.

### Tests

- `pageSvg.test.ts`: viewBox is the page; a shape on page 2 is absent from page 1; an edge is one
  path with its markers; rows are text; tags appear.
- `pagePng.browser.test.ts`: page color at a corner, a shape's fill at its center, size is page × scale.
- Chart test: the export commands hand `downloadBlob` an SVG and a PNG named for the page.

## 7. Containers and swimlanes in `DiagramData`

### What the user sees

A data-backed `DiagramView` draws containers and pools from data and edits them the way chart mode
does: drag a shape into a container or lane, drag a container to carry its members, resize it,
drag a lane boundary, drag a lane header to reorder, click the add-lane button, double-click a
header to rename. Each reports and changes nothing until the data follows.

### The model

```ts
interface DataContainer {
  id: string;                              // shares the node id namespace
  role: 'container' | 'pool';
  label?: string;
  members?: readonly string[];             // container: node and container ids
  lanes?: readonly DataLane[];             // pool only
  axis?: 'x' | 'y';                        // pool: as containerShape reads it; default 'y'
  box?: { x: number; y: number; width: number; height: number };
  style?: string;                          // theme role
}
interface DataLane { id: string; label?: string; size?: number; members?: readonly string[] }
```

`DiagramData.containers?: readonly DataContainer[]`.

**Decisions (2026-10-20).**
- A container with a `box` is laid out as one node of that size; its members are not laid out,
  ride along with it, and a member with no `at` is seeded inside its body in rows. A container
  with no `box` is laid out as a group (`cluster.ts`), and its box fits its members after layout.
  One field says whether the author has shaped it.
- A pool always has a box, `600 × 120` per lane when none is given: lanes are bands across the
  pool, which no shipped layout can keep members inside, and laying the pool out as one block is
  what does.
- An edge with an end inside a region ranks against the outermost region holding it, as an edge
  naming a group meets its box.

### Engine surface (`packages/diagram/src/`)

- `fromData.ts`'s data types move to `dataTypes.ts` first (re-exported) to make room.
- `containers/regionSpecs.ts`: `regionSpecs` and `firstLanes`, moved out of `containerStencils.ts`
  and exported, so stencils and data build regions one way.
- `dataContainers.ts`, beside `dataGroups.ts`: `containerLayoutNodes(data)` (what layout sees) and
  `containerSpecs(data, placed, opts)`, region specs before member specs (parents first, as
  `createScene` requires), each member given its region as `parent`.
- `diagramViewProps.ts`:
  - `NodeMove.parent?: string | null`, present when a drop changed the region a node is in (`null`
    for the top level); the host moves the id between `members` lists.
  - `onEditContainer?: (edit: ContainerEdit) => void`, where `ContainerEdit` is
    `{ kind: 'box'; id; box }` (moved or resized) | `{ kind: 'lanes'; pool; lanes: { id; size }[] }`
    (resized, reordered, or added: a new lane id is minted by the view) | `{ kind: 'release'; id }`
    | `{ kind: 'title'; id }` (double-click on a header; the host edits the label, as with
    `onEditLabel`).
- `sceneSync.ts` reads parents, region boxes, and lane order and lane sizes into `Standing`. A
  region's handle resize is not among them: `DiagramView` reports handle resizes from the resize
  action's swapped commit (`reportResizeAction` in `diagramEditing.ts`) and writes nothing, since
  `reconcileSpecs` diffs spec against spec and could never put back a size the data clamped.
- `diagramEditing.ts` installs, when `onEditContainer` is set, `diagramContainers` with its lane
  commits swapped for reports, `diagramCanDropInto` as the `canDropInto` dep, and the lane layer.
  `DeleteReport.nodes` includes a deleted region's members, as a chart-mode delete takes them.
- `specRoutes.ts`: regions and headers become obstacles, matching `avoid/sceneInput.ts`.
- `DiagramSceneOptions.theme` colors regions from `container` and `lane`.

### Save, load, undo

The host's data holds it all. Members' `at` stay absolute world points, as every `at` is.

### Tests

- `dataContainers.test.ts`: parents, boxed and fitted boxes, pool lanes stacked, members seeded.
- `fromData.containers.test.ts`: a boxed region lays out as one node; an edge into a member ranks
  against its region.
- `sceneSync.test.ts`: parent change and box edit reported; a reconcile reports nothing.
- `DiagramView.containers.browser.test.tsx`: drag into a container and a lane, resize a boundary,
  reorder by header, add a lane: each reports once.
- `specRoutes.test.ts`: a route avoids a region neither end is in.

## 9. Pipeline groups as editable containers

### What the user sees

Under Node graph, a pipeline group is a titled box like a chart container: drag a stage in or out
to change membership, drag the box to carry its stages, resize it, double-click its title to
rename. Arrange › Group (⌘G) groups the selected stages; Arrange › Ungroup (⇧⌘G) dissolves the
picked group. Under Rack and Lanes, groups draw as today, and Group, Ungroup, and renaming in the
Params sidebar work; dragging membership does not.

**Decision (2026-10-20).** Groups become data containers only under `nodeGraph`: rack and lanes
place every stage, so an authored box would contradict the look, while a box fitting its members
holds in every look.

### Engine surface (`packages/diagram/src/effect/`)

- `EffectDoc.groupBoxes?: Readonly<Record<groupId, Box>>`, a sidecar like `places`.
- `editorMapping.ts`: under `nodeGraph`, each `EffectGroup` maps to a `DataContainer` with
  `box: doc.groupBoxes?.[id]` (fitting its members while unset, piece 7); other looks keep mapping
  it to a `DataGroup`.
- `groupEdit.ts`: `groupStages(doc, ids, label?)` (nested inside the group all of them share, if
  any), `ungroup(doc, id)` (members go to its parent group), `renameGroup`, `moveToGroup(doc, ids,
  group | null)`, `setGroupBox(doc, id, box | null)`, and `moveGroup(doc, id, offset)`, which moves
  member places, the box, and inner wires' `routes` together; `removeStages` prunes `groupBoxes`.
- `EffectEditor`: `selectedGroup` and `onSelectGroup` beside the stage pick; `onMove` with
  `parent` and `onEditContainer` map to the edits above. Labels: "Move", "Resize group", "Group",
  "Ungroup", "Rename group".
- App: `apps/chart/src/pipeline/pipelineCommands.ts` gains the Arrange items; `ParamPanel.tsx`
  shows a picked group's name field.

### Save, load, undo

Membership saves in `EffectPipeline.groups`, as now, and boxes in `groupBoxes`; older files load
with every group fitting its members. Each edit is one `onChange`, one entry in the pipeline history.
A dragged group is one `moveGroup` (below): its stages, its box, and the routes of wires with both
ends inside move by one offset, the rule `waypointFollower` keeps in chart mode.

### Tests

- `groupEdit.test.ts`: nesting, ungroup to parent, pruning.
- `editorMapping.test.ts`: a container under `nodeGraph`, a group under the others.
- `EffectEditor.groups.browser.test.tsx`: drag a stage into a group box; resize it; undo through
  the app's pipeline history (`usePipelineDoc.ts`).

## 10. Theme builder

### What the user sees

Format › Theme › Edit Theme… opens a Theme panel in the Format sidebar. It lists every role with
its fill, stroke, and text swatches; the connector, label, container, lane header, and lane body
colors; the page color; the font family and size; and the series colors. Roles can be added,
renamed, and removed (not the default role). The chart recolors live as a color is dragged, and
one undo takes back the whole drag. Format › Theme › Import Theme… and Export Theme… read and
write `.weasel-theme.json` files.

**Decisions (2026-10-20).**
- Shipped themes are read-only. The first edit forks the current theme into the document as a
  custom theme named "<name> (edited)"; later edits change it in place. A custom theme lives in the
  document only (the `diagram:theme` value already holds a whole theme), and files carry it
  between documents, so there is no second store to keep in step.
- A removed role's shapes fall to the default role at the next apply, the rule `themeWrites`
  already follows for a role a theme lacks.

### Core foundation: coalesced batches

`scene.batch(label, fn, { coalesceKey })` in `packages/core/src/core/scene/recorder.ts`: the entry
it records carries the key, and `@weasel-js/history` (`history.ts`) folds it into the entry just
before it when that one carries the same key, as it already folds keyed ops. The undo restores the
state before the first of them.

### Engine surface (`packages/diagram/src/theme/`)

- `types.ts`: `DiagramTheme.roleLabels?: Record<string, string>` for roles beyond `DIAGRAM_ROLES`.
- `themeEdit.ts`: `forkTheme(theme)`, `ThemePath` (`['roles', id, 'fill' | 'stroke' | 'text']`,
  `['edge', 'stroke']`, `['page']`, …), `setThemeValue(theme, path, value)`, `addThemeRole`,
  `renameThemeRole`, `removeThemeRole`.
- `themeFile.ts`: `parseDiagramTheme(json) → { theme } | { errors }`, `themeToJson(theme)`,
  `DIAGRAM_THEME_EXTENSION = '.weasel-theme.json'`.
- `applyTheme.ts`: `applyDiagramTheme(scene, theme, label, { coalesceKey })`.

App: `apps/chart/src/theme/ThemePanel.tsx` on `PropertyPanel`, `ColorField`, `FontFamilySelect`,
`NumberField`, and `ListEditor` from `@weasel-js/ui`, with one section per file if it grows. A
field change applies at most once a frame, throttled through `useVisibleRaf`, keyed
`theme:<path>`, labeled "Edit theme".

### Save, load, undo, and what else it reaches

The custom theme saves as the `diagram:theme` value, which `diagramThemeOf` already reads back.
A drag on one field is one entry; a role added, renamed, or removed is one each. Each apply goes
through `themeWrites`, so it reaches containers, lanes, edge labels, and piece 3's tags, and leaves
every `ownStyle` color, imported ones included (piece 12). New shapes and connectors take the
edited theme through the inserts chart already builds from it (`useChartDiagram.tsx`).

### Tests

- `themeEdit.test.ts`: fork leaves the shipped theme alone; each path sets; role add, rename, remove.
- `themeFile.test.ts`: round trip; a missing role or bad color is an error naming it.
- Core `batchCoalesce.test.ts`: two batches with one key are one entry; another key or an edit
  between makes two; undo restores the first state.
- `ThemePanel.test.tsx`; `theme.browser.test.tsx`: drag a role color, read a shape's pixels, one
  undo restores both the pixels and the doc value.

## 12. Interchange document model

### What the user sees

File › Import… opens a supported file as a new chart: one undo entry, "Import". Anything the
format had that a chart cannot hold is listed in a toast. File › Export › As … writes the whole
chart, or the current page for formats with no pages (piece 13).

### The model (`packages/diagram-formats/src/document.ts`)

```ts
interface DiagramDocument { pages: readonly DocumentPage[]; theme?: string | DiagramTheme }
interface DocumentPage { id: string; name?: string; width: number; height: number; data: DiagramData }
interface ImportResult { document: DiagramDocument; warnings: readonly string[] }
interface DiagramFormat {
  id: string; name: string; extensions: readonly string[];
  detect(text: string): boolean;
  read?(text: string): ImportResult | Promise<ImportResult>;
  write?(doc: DiagramDocument, opts?: { page?: string }): string;
}
```

`DIAGRAM_FORMATS` lists the codecs; `detectFormat(text, fileName?)` picks one. A page's
coordinates are page-relative.

**Decision (2026-10-20).** Every codec reads and writes `DiagramDocument`, built on the package's
existing `DiagramData`, and only `fromScene` and `toScene` know scenes, so a codec is written once
for both chart mode and a data-backed host.

### Engine surface

- In diagram (`dataTypes.ts`, `fromData.ts`): `DataNode.colors?: Partial<NodeStyle>`,
  `DataEdge.colors?: Partial<EdgeStyle>`, `DataContainer.colors?`; `diagramScene` writes them as
  literal colors and lists them in `ownStyle`, so a theme change leaves an imported color.
  `DiagramSceneOptions.layer` (default `'main'`).
- `fromScene.ts`: `documentFromScene(scene)`, reading pages (`pagesOf`, `pageMembers`), each
  participant's outline, box, rows, and colors, each edge's ends, ports, router, waypoints (an
  `avoid` connector's stored `route` as waypoints), and label, and containers and pools.
- `toScene.ts`: `documentSpecs(doc, { layer, theme, measure }) → { specs; doc: SerializedDoc }`:
  pages placed with `layoutPages`; each page through `diagramScene` with `layout: 'none'` when every
  node has `at`, else `'layered'` with the placed ones pinned; offset by its page's place;
  `core:pages` and `diagram:theme` in `doc`.
- App: `apps/chart/src/importExport.ts` (`pickFile`, `detectFormat`, `replaceChart`).

### Tests

- `fromScene.test.ts`, `toScene.test.ts`; `roundTrip.test.ts`: scene → document → specs gives the
  same places, outlines, colors, edges, labels, containers, and pages.

## 13. Mermaid and Graphviz DOT

Both carry a graph's topology and labels, not its geometry (DOT's only when every node has `pos`),
so import lays out with `layered`, which the package already does well.

### Mappings

| Diagram | Mermaid flowchart | Graphviz DOT |
|---|---|---|
| rect | `A[text]` | `shape=box` |
| stadium | `A([text])` | `shape=box, style=rounded` |
| diamond | `A{text}` | `shape=diamond` |
| ellipse | `A((text))` | `shape=ellipse` |
| hexagon | `A{{text}}` | `shape=hexagon` |
| parallelogram | `A[/text/]` | `shape=parallelogram` |
| trapezoid | `A[/text\]` | `shape=trapezium` |
| edge, label | `A -->|text| B` | `A -> B [label=…]` |
| container | `subgraph` | `subgraph cluster_*` |
| direction | `flowchart TD/LR/BT/RL` | `rankdir` |
| colors | `style` and `classDef` fill and stroke | `fillcolor`, `color`, `fontcolor` |
| ports | — | `node:port:compass`, compass only |

Unknown Mermaid shapes read as rect with a warning; other Mermaid diagram kinds are refused with an
error naming the kind. DOT reads the full grammar (strict, graph and digraph, attribute statements,
edge chains, subgraphs); HTML labels are read as their text. Pools and lanes have no equivalent in
either and export as nested containers.

### Engine surface (`packages/diagram-formats/src/`)

`mermaid/` and `dot/`, each `lex.ts`, `parse.ts` (to a syntax tree), `read.ts`, and `write.ts`,
registered in `DIAGRAM_FORMATS` with extensions `.mmd`/`.mermaid` and `.dot`/`.gv`. Export writes
the current page. Saving and undo are piece 12's: an import is one entry, an export writes nothing.

### Tests

- Parser tests over fixtures in `__fixtures__/`; read tests per row of the table; write then read
  gives the same topology, labels, shapes, and containers; warnings for each unsupported construct.
- Chart test: import a `.mmd`, the canvas holds the laid-out nodes.

## 14. Draw-style XML

The one format in scope that carries geometry: a `<diagram>` per page holding a graph model of
cell elements, each with a `key=value;` style string and a geometry element, plain or
compressed. A chart round-trips through it laid out, with pages, colors, waypoints, containers,
and swimlanes.

### Mappings

| Diagram | Style and structure |
|---|---|
| outline | `shape=rhombus` diamond, `ellipse`, `hexagon`, `parallelogram`, `trapezoid`; `rounded=1` with `arcSize` 50 or more is stadium; other shapes are rect, with a warning |
| colors, font | `fillColor`, `strokeColor`, `fontColor`, `fontSize`, `fontFamily` |
| text | `value`; with `html=1`, tags stripped and `<br>` kept as a line break |
| router | `edgeStyle=orthogonalEdgeStyle` orthogonal, `curved=1` bezier, none straight; `avoid` exports as orthogonal with its route as points |
| waypoints | the edge geometry's points array |
| ports | `exitX`/`exitY`, `entryX`/`entryY` to the nearest compass port |
| container, pool, lane | `container=1`; `swimlane` with `horizontal` for pools and lanes |
| page | one `<diagram name=…>` each |

### Engine surface (`packages/diagram-formats/src/drawXml/`)

`read.ts` parses with `DOMParser`, the environment `@weasel-js/svg`'s `parseSvg` already needs;
compressed content is base64, raw deflate (`DecompressionStream('deflate-raw')`), then URI-decoded,
so its `read` answers a promise. `write.ts` writes uncompressed, escaping with `escapeAttr` and
`escapeText` from `@weasel-js/svg`'s `xmlEscape.ts`, exported from its barrel in this piece.
`style.ts` parses and writes style strings. The extension is `.xml`, and a file is recognized by
its root element rather than its extension. Saving and undo are piece 12's.

**Decisions (2026-10-20).**
- In scope: draw-style XML, Mermaid, DOT, SVG export, and PNG export. Packaged office-suite drawing
  formats are out: they are zip archives of many XML parts built on a master-shape system the scene
  has no equivalent for. SVG import is out: an SVG carries drawn paths, not shapes and connectors,
  so a connector would arrive as a path that follows nothing.
- PDF waits for the fourth arc: a faithful PDF needs font subsetting and embedding, a writer the
  repo does not have and which, needing nothing from weasel, is a package of its own.

### Tests

- `style.test.ts`; `read.test.ts` over plain and compressed fixtures, a row of the table each;
  `roundTrip.test.ts`: a chart with pages, a pool, waypoints, and colors exports and reads back
  equal; warnings for unknown shapes.
- Chart browser test: import a fixture, see two page tabs and a pool.

## Fourth arc (not designed)

- PDF export, as its own package.
- Playing an audio pipeline through `@weasel-js/audio`: a graph built once on the audio clock and
  patched as the pipeline is edited.
- Pages in a data-backed `DiagramView`, and off-page markers there.
- Dragging an edge label by hand, which label placement then keeps.
- Authored group boxes under the `rack` and `lanes` looks.
