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
| 2 | Resize reporting in `DiagramView` | diagram | — | 1 |
| 8 | Waypoint editing under `rack` and `lanes` | diagram | — | 1 |
| 10 | Theme builder | core, diagram, app | — | 1 |
| 11 | Running a pipeline | diagram, app | — | 1 |
| 3 | Off-page reference markers | diagram, app | — | 2 |
| 5 | Line jumps | diagram, app | — | 2 |
| 6 | Exporting one page | new `diagram-formats`, app | merges after 3 | 2 |
| 7 | Containers and swimlanes in `DiagramData` | diagram | 2 | 2 |
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
| `packages/diagram/src/edge.ts` | 218 | 3, 5 | done: the four routers are in `routers.ts` |
| `packages/diagram/src/fromData.ts` | 386 | 7, 12 | piece 7: the data types move to `dataTypes.ts`, re-exported |
| `packages/diagram/src/effect/EffectEditor.tsx` | 247 | 8, 9, 11 | piece 8: `editHandlers` and its helpers move to `effect/editorHandlers.ts` |
| `packages/diagram/src/diagramViewProps.ts` | 175 | 2, 5, 7 | none needed; each adds props |

Every piece also: writes `patch` changesets; keeps files under 400 lines and functions under 120
(`npm run check:size`); exports only public surface to the app; updates the diagram README and
`docs/TODO.md`'s weaselchart entry in its merge; and deletes its own section of this doc when it
merges (the doc goes with the last piece). Points, offsets, and boxes here are `Vec2` and plain
boxes on purpose: everything in this arc lives on the page plane, and kernel3d hosts route no
connectors (the second arc's call, kept).

## 2. Resize reporting in `DiagramView`

### What the user sees

In a `DiagramView` with `onResize` set, a selected node shows resize handles. Dragging one resizes
the box live; releasing reports the new box and changes nothing until the data follows.

### Engine surface (`packages/diagram/src/`)

- `diagramViewProps.ts`: `onResize?: (resizes: readonly NodeResize[]) => void`.
- `sceneSync.ts`: `NodeResize { id: string; x: number; y: number; width: number; height: number }`.
  `Standing` keeps each node's size beside its place; `changes` reports a node whose size changed
  as a resize, not a move.
- `DiagramView.tsx`: with `onResize`, `features` gains `'resize'` and the select tool takes
  `resize: { resizable: diagramResizable(scene) }` (`resizable.ts`), which already refuses edges,
  labels, and lanes; it also refuses group boxes, which derive their size.

The host stores `width` and `height` on the `DataNode` (with `at` and `pinned`). Those are minimums
already, so a box dragged smaller than its rows grows back to them, the rule scene bodies follow.

**Decision (2026-10-20).** `EffectEditor` sets no `onResize`: every look sizes a stage from its
rows, so a stored stage size would contradict the look.

### Save, load, undo

The host's data holds the size; undo is the host's, one entry per reported resize. Under
`router="avoid"` the next specs reroute what the new box disturbs, as for a move.

### Tests

- `sceneSync.test.ts`: a size change is a resize, a place change a move, a layout run neither.
- `DiagramView.resize.test.tsx`: handles only with `onResize`; nothing changes until specs follow.
- `DiagramView.resize.browser.test.tsx`: a real handle drag reports one resize on release.

## 3. Off-page reference markers

### What the user sees

A connector whose two shapes sit on different pages stops drawing across the gap. Each end draws a
short stub out of its shape, ending at a small tag reading the other page's name and a reference
letter, such as "Page 2 · A". The arrowhead still points into the target shape, and the start stub
gets the connector's end marker at its tag, so it reads as leaving the page. Double-clicking a tag
fits the view to the other page and selects the shape at the far end. Dragging a shape back onto
the other's page joins the connector again on release; during a drag it draws across, as now.

**Decision (2026-10-20).** Splitting is automatic, with no per-connector opt-out: a line across the
gap prints as nothing on paper, and piece 6 exports pages one at a time.

### Engine surface (`packages/diagram/src/offPage/`)

- `trait.ts`: `DiagramEdge.offPage?: { ref: string; from: string; to: string }` (the reference and
  the two page ids), owned by the pass the way `route` is owned by the router. A tag carries
  `data.diagram.offPageTag: { edge: string; end: 'from' | 'to' }`, read with `offPageTagOf`.
- `split.ts`, pure: `offPageSplits({ pages, edges }) → Map<edgeId, OffPageSplit | null>`, using
  core's `pageOfBounds` on each end's box. An end in a gap belongs to no page and never splits.
  `nextOffPageRef(used)` gives A…Z, AA…; a ref, once given, stays while the split does.
- `tag.ts`: `offPageTagSpec(edgeId, end, text, style)`, a kit text leaf `<edge>/offpage-<end>`
  with a `background` and `padding`, `dependsOn: [edge]`, and `derivePose: OFF_PAGE_TAG_DERIVE_POSE`
  (registry key `diagram:offPageTag`, added in `withDiagramRegistry`), stationed past its stub's tip.
- `install.ts`: `installOffPageMarkers(scene)` and `useOffPageMarkers(scene)`, an edit pass at
  `DIAGRAM_PASS_ORDER.offPage`. It recomputes every edge when `docChanged` has `core:pages`, and
  otherwise the edges attached to posed, added, removed, or re-parented nodes. It writes `offPage`,
  and adds, removes, or retexts the two tags.
- `edge.ts`: `edgeRouter` answers a split edge with `ResolvedRoute.stubs`, two two-point runs
  `OFF_PAGE_STUB` (24) long along each port's normal, and `edgeDerivePath` draws them as two
  subpaths. The kit draws end markers on every open subpath, which is what gives the start stub its
  tag-end marker.
- `follow.ts`: `FOLLOW_OFF_PAGE_ACTION_ID = 'diagram.followOffPage'`,
  `createFollowOffPageAction({ follow? })`, bound to a double-click on a tag the way
  `editEdgeLabelBinding` binds one. The default `follow` selects the far shape and sets the `view`
  dep with `fitViewToPage`. `diagramOffPage(opts) → { contribution }` packs it.

**Decision (2026-10-20).** A tag is a text node with a background, not a shaped symbol: the kit's
text painter and SVG lowering already draw that, so no new painter or exporter is needed.

### Works with

| Second-arc code | Effect |
|---|---|
| `avoid/sceneInput.ts` | skips edges with `offPage`; when a split ends, the edge is new to the router and is routed in the same entry (piece 1's order puts this pass first) |
| `waypoints.ts` `routeHandles` | none for a split edge; its waypoints are kept and come back when it joins again |
| `label.ts` `labelCenter` | stations on the first subpath of a path that has several |
| `theme/themeWrites.ts` | colors tags: text in `label.fill`, background in `page` |
| `core/pages/pageEdits.ts` | moving or resizing pages re-splits through `docChanged`, in the page edit's entry |

### Save, load, undo

`offPage` and the tags save with the scene. On load nothing recomputes. A split or join is part of
the edit that caused it: a move, a page reorder, or a resize.

### Tests

- `split.test.ts`: overlap rule, gap ends, ref reuse and next ref.
- `offPage.scene.test.ts`: a move to another page splits in the move's entry; undo joins; a page
  reorder keeps the ref and retexts tags; deleting a shape removes its edge's tags.
- `edge.test.ts`: a split edge derives two subpaths; markers on both.
- `offPage.browser.test.tsx`: double-click a tag, the view lands on the other page.
- Chart browser test: two pages, connect across, the canvas pixels in the gap show no line.

## 5. Line jumps

### What the user sees

Format › Connector › Line jumps turns hops on for the whole chart: where two connectors cross, the
one drawn on top bows over the other in a small half circle. During a drag, hops on the connectors
being moved disappear and come back on release.

**Decisions (2026-10-20).**
- Hops are on or off for the document, not per connector: a crossing has two connectors, and which
  one hops is the pass's rule, so a per-connector setting would answer the question twice.
- The connector later in render order hops, so the hop is drawn on the line that paints on top.
- Arcs only, no gap style: a gap splits the stroke into subpaths, and the kit draws end markers on
  every open subpath, so an arrowed connector would grow an arrowhead at each gap.
- A hop bulges toward −y on a horizontal run and toward −x on a vertical one, whatever the direction
  of travel, so every hop on a page bulges the same way; a diagonal run bulges to the left of travel.

### Engine surface (`packages/diagram/src/hops/`)

- `HOPS_DOC_KEY = 'diagram:hops'`, value `{ size: number }` (radius, default 5) while on, absent
  while off.
- `DiagramEdge.hops?: readonly { at: Vec2; over: string; r: number }[]`, literal, so any reader
  draws them with no doc value, as themes write literal colors.
- `crossings.ts`, pure, in `@weasel-js/diagram/layout`: `edgeHops(polylines, order, r)` finds
  proper crossings of general segments through avoid's `SpatialHash` (`avoid/hash.ts`), skips
  crossings within `2r` of either connector's ends and collinear overlaps, and merges hops closer
  than `2r` into one longer hop.
- `draw.ts`: `withHops(points, hops) → Path` replaces the stretch within `r` of each hop with a
  half circle. `edgeDerivePath` uses it when a non-split edge has hops, keeping only those whose
  point lies on the routed polyline within 0.5, so a stale hop never draws.
- `install.ts`: `installHops(scene)` and `useHops(scene)`, an edit pass at `DIAGRAM_PASS_ORDER.hops`,
  idle while the doc value is absent. It holds each connector's last polyline. On the key changing
  it recomputes or clears every edge; otherwise the dirty set is connectors attached to changed
  nodes, connectors whose data changed, and connectors whose last polyline meets a dirty one's old
  or new box. Polylines come from `edgeRouter` (pre-hop), never from the derived path.
- `hopFollower(scene)`: a transform follower that previews the moved connectors, and every
  connector hopping over one, without hops.
- `SET_HOPS_ACTION_ID = 'diagram.hops'`, a toggle that writes the doc value, in `diagramWaypoints`'
  contribution beside the router commands. `DiagramView` takes `hops?: number`, applied by
  `createSpecHops(r)` after the spec router and label placer.

### Save, load, undo

The doc value and each edge's hops save with the scene. Toggling is one entry; a recompute joins the
edit that caused it.

### Performance budget

`hops/hops.bench.ts`: commit, 300 connectors with 20 dirty, 3 ms; all 300, 25 ms.

### Tests

- `crossings.test.ts`: proper crossings only; ends and overlaps skipped; merging; render order.
- `draw.test.ts`: arc geometry; bulge side per axis; stale hops dropped.
- `hops.scene.test.ts`: a move creates and removes hops in its entry; toggling off clears in one
  entry; undo restores.
- Chart browser test: two crossing connectors, toggle on, the top one's pixels leave its line at the
  crossing.

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

An export reads the scene and writes nothing, so it has no history entry. Hops (piece 5), placed
labels (`diagram.label.placed`), and stored routes are in the scene, so the export draws them as the canvas does.

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
- `sceneSync.ts` reads parents, region boxes, and lane order and lane sizes into `Standing`.
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

## 8. Waypoint editing under `rack` and `lanes`

### What the user sees

In pipeline mode under Rack and Lanes, a selected wire shows route handles as under Node graph, and
dragging them reroutes it. Format › Connector › Reset route gives the wire back to the look. A
reorder, an added stage, or a deleted one that moves either end of the wire gives it back too.

### The model

`EffectDoc.lookRoutes?: { rack?: Record<wireId, LookRoute>; lanes?: Record<wireId, LookRoute> }`,
`LookRoute { waypoints: readonly Vec2[]; ends: readonly [Vec2, Vec2] }`.

**Decision (2026-10-20).** A look route holds only while the wire's two port points are where they
were when it was drawn (`ends`), the rule `laidOut` uses for layout's routes: rack and lanes move
stages on every reorder and insert, and a route drawn for one arrangement means nothing in another.

### Engine surface (`packages/diagram/src/effect/`)

- `EffectEditor.tsx` first moves `editHandlers` and its helpers to `editorHandlers.ts`.
- `lookRoutes.ts`: `setLookRoute(doc, look, wire, waypoints, ends)`, `applyLookRoutes(specs, doc,
  look, built)`, which sets an edge's `waypoints` where `ends` match the port points of the built
  specs (the author's `waypoints` win over `lanes`' `routed`, by `DataEdge`'s rule), and
  `pruneLookRoutes(doc)`, called by `removeWires`, `removeStages`, `moveInChain`, and
  `setLaneOrder`.
- `EffectEditor` passes `onEditRoute` under every look; the handler writes `setWireRoute` under
  `nodeGraph` and `setLookRoute`, with ends read from the shown specs, under the others. Label:
  "Edit route".

### Save, load, undo

`lookRoutes` saves with the pipeline document; older files have none and load unchanged. Each
drag is one `onChange`, so one entry in the app's pipeline history. Reset route under rack and
lanes is `setLookRoute` with no waypoints, also one entry.

### Tests

- `lookRoutes.test.ts`: applied while ends match, ignored after a reorder, pruned by each edit.
- `EffectEditor.route.test.tsx`: a route edit under `lanes` reports "Edit route" with `lookRoutes`.
- `EffectEditor.lookRoute.browser.test.tsx`: a real segment drag under lanes, then a reorder drops it.

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

## 11. Running a pipeline

### What it means

`effect/` already draws a run (`EffectRun`: cost, values, previews, the decision `taken`), and
chart's stage types carry `image`, `mask`, and `number` values. Running means evaluating the
pipeline over an input image and drawing the run on the editor: once, a stage at a time, or every
frame while playing.

**Decision (2026-10-20).** Not audio playback: the stage types are image types, and an audio graph
runs continuously on the audio clock rather than evaluating once per pass, which needs a different
runner contract (fourth arc).

### What the user sees

A Run menu in pipeline mode: Run, Step, Play, Pause, Reset, and Choose Source Image…. Run fills
every stage's cost, its output values, and a preview of each image output. Step evaluates the next
stage and outlines it; its values appear as it finishes. Play re-runs every frame with time
advancing, so an Oscillator's value moves and a Decision flips. A stage that fails shows its error
in the problem color, and what it feeds stays faded. Editing a param while playing shows on the
next frame. View › Show Values and Show Previews turn the look's rows on. Without a chosen image,
sources start from a generated test card.

### Engine surface (`packages/diagram/src/effect/runner/`, in `@weasel-js/diagram/effect`)

- `types.ts`: `EffectEvaluator` (`(ctx: { stage; inputs; params; time; signal }) =>
  { outputs; taken? }`, sync or async) and `EffectValueKind` (`show(value)`, `preview(value,
  size)`, `dispose(value)`), each keyed by stage `type` and value type.
- `order.ts`: `runOrder(pipeline) → { order; cyclic }`, topological over data and control wires,
  stable by stage order.
- `runPipeline.ts`: `runPipeline(pipeline, opts) → Promise<EffectRun>`. A stage none of whose fed
  inputs is reached is skipped; a bypassed stage passes its first input of each output's type
  through; a throwing evaluator sets `EffectStageRun.error` and leaves what it feeds unreached;
  stages in a cycle never run.
- `runner.ts`: `createEffectRunner(opts)` with `run()`, `step()`, `play()`, `pause()`, `reset()`,
  `setPipeline`, `setInputs`, and `subscribe`. It owns its values and closes the bitmaps of a run
  once a newer one has been drawn.
- `useEffectRunner.ts`: play through `useVisibleRaf` (`@weasel-js/react`), with `onResume`
  rebasing the clock; a frame starts a run only once the last finished.
- `effect/types.ts`: `EffectStageRun.error?: string`, `EffectRun.at?: string` (the stage Step is on);
  `run.ts`'s `paintRun` outlines `at` and writes `error` where the cost goes.
- `EffectEditor` takes `run?: EffectRun`, painted with `paintRun` as `EffectChart` does.
- `image/`: `IMAGE_STAGE_TYPES` (chart's `CHART_STAGE_TYPES` moved here; chart imports them),
  `imageEvaluators` on `OffscreenCanvas` 2D (blur by `filter`, composite by
  `globalCompositeOperation`, mask by `destination-in`, oscillator `sin(2π·rate·t)`, decision by
  its `split`, else its first output while the tested number is above 0), `imageValueKinds`, and
  `testCard(size)`.

**Decision (2026-10-20).** A stage type and its evaluator ship together in the engine: they are one
definition, and labkit's pipeline labs need both.

### Save, load, undo

A run is not document state: nothing saves and nothing undoes. The chosen source image is held for
the session.

A run draws under every look. A stage reorder, a rewire, or a param edit is a new doc, which the
runner takes with `setPipeline`, so the next run or played frame follows it. `paintRun` edits data
only, so a running chart never lays out again, and groups (piece 9) and look routes (piece 8) are
untouched by it.

### Tests

- `order.test.ts`; `runPipeline.test.ts` with fake evaluators: order, skipped exits, bypass,
  error, cycle.
- `runner.test.ts`: step advances `at`; reset; play with a fake frame source; old bitmaps closed.
- `imageEvaluators.browser.test.ts`: each operation changes the pixels it should.
- `EffectEditor.run.test.tsx`; chart `pipeline.browser.test.tsx`: run, step, play, pause.

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
