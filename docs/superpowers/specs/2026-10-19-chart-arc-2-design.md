# weaselchart (`apps/chart`), second arc — design

**Pieces 2 to 6 unbuilt as of 2026-10-19.** Piece 1, waypoint editing, landed with core's transform followers (`useTransformFollower`).

For whoever builds each piece of the second arc. It says what the user does and sees in
weaselchart, which engine surface each piece adds and where, how it saves and undoes, and which
tests prove it. Read `CLAUDE.md` ("Scope", "What gets its own package", "Module shape",
"Terminology") and `docs/taxonomy.md` first; this doc does not restate them.

The first arc (merged; its spec deleted, readable at
`git show 89e332f4d:docs/superpowers/specs/2026-10-19-chart-app-design.md`) set the rules this arc
keeps: every editing ability is engine surface in `@weasel-js/diagram` or core, each editing action
has a swappable commit (scene ops by default, a data-edit callback for a data-backed host such as
`DiagramView` or `EffectEditor`), and the app only proves it. labkit will reuse all of it.

## Build order

Each piece lands in its own worktree and merges on its own green `npm run test:fleet` and
`npm run test:gate`. Foundations land with the first piece that needs them.

| # | Piece | Core foundation it adds | Needs |
|---|---|---|---|
| 2 | Stage reorder under `rack` and `lanes` | — | — |
| 3 | Multiple pages | scene document values | — |
| 4 | Themes | — | 3 (document values) |
| 5 | Containers and swimlanes | drop filter dep; layout passes carry descendants | — |
| 6 | Obstacle-avoiding routing | scene edit passes | 5 |

The suggested order holds. Stage reorder sits second although it shares nothing with the others,
because it closes out pipeline mode's first-arc gap while the scene foundations are still in review.

Every piece also: writes `patch` changesets; keeps files under 400 lines and functions under 120
(`npm run check:size`); exports only public surface to the app; updates the diagram README's
editing section and `docs/TODO.md` in its merge; and, when it merges, deletes its own section of
this doc (the doc is deleted with the last piece).

## 2. Stage reorder under `rack` and `lanes`

### What the user sees

Pipeline mode gains View › Look › Node graph / Rack / Lanes. Under rack and lanes, connecting,
reconnecting, deleting, and param editing work as under node graph; free moves do not. Instead,
dragging a stage on the main line lifts it, it follows the pointer along the flow axis, and an
insertion bar shows between the two stages it would land between. Releasing splices it in there.
Where the splice cannot type-check, the bar draws in the problem color and release does nothing.
Under lanes, dragging a lane's label up or down reorders the lanes.

### What a reorder means

**The wiring is the order (2026-10-19).** Both looks place stages from the wires (`mainChain` for
rack, `columnsOf` for lanes), so a reorder rewires: the stage's main input and output wires come off,
its old neighbors are wired to each other, the wire between its new neighbors comes off, and the
stage is wired between them. Side wires, control wires, and params stay with the stage. A second
stored order could contradict the wiring, so none is kept.

**Only stages on the main line drag (2026-10-19).** An off-line stage sits where what it feeds
puts it, so there is no slot to drag it to.

### Engine surface

- **`effect/chainEdit.ts`**: `chainLinks(pipeline, chain)` (the main-in and main-out port of each
  chain stage, moved out of `rack.ts`'s `Line` so rack and the edit share one answer),
  `canMoveInChain(doc, stage, to)`, and `moveInChain(doc, stage, to) → EffectDoc | null`.
- **`EffectLookResult.order?: LookOrder`** in `effect/draw.ts`:
  `{ axis: 'x' | 'y'; items: { id, bounds }[]; gaps: { index, a: Vec2, b: Vec2 }[] }`, the slots a
  drag can land in, in world units. `rack` and `lanes` fill it; `lanes` also fills `laneOrder` with
  each lane's header box.
- **`slotReorder.ts`** in the diagram root, general to any drawing that is a sequence:
  `REORDER_ACTION_ID = 'diagram.reorder'`, `createReorderAction({ slots, canDrop, commit })` where
  `slots(ctx) → ReorderSlots | null` and the commit hears `{ id, from, to }`. It previews the
  dragged node along the axis through a pose override and draws the insertion bar as its overlay.
- **`EffectDoc.laneOrder?: readonly string[]`** and `setLaneOrder(doc, order)` in `effect/edit.ts`;
  `editorScene` hands it to `lanes` as `LanesOptions.lanes`.
- **`EffectEditor`** takes `look?: 'nodeGraph' | 'rack' | 'lanes'` and that look's options;
  `editorScene(doc, look, options)` replaces the `nodeGraph`-only mapping in
  `effect/editorMapping.ts`. Undo labels: "Reorder", "Reorder lanes".

**The look is a view choice, kept in the session, not the document (2026-10-19)**: one pipeline is
meant to read in every look. `compact` stays view-only.

### Save, load, undo

A reorder is a pipeline edit, so it saves with the pipeline. `laneOrder` is a new optional field;
older files load unchanged. Each reorder is one `onChange`, so one entry in the app's pipeline
history (`apps/chart/src/pipeline/usePipelineDoc.ts`).

### Tests

- `chainEdit.test.ts`: splice forward and back, to either end; type mismatch refuses; side and
  control wires stay; `mainChain` after a splice puts the stage at its target.
- `rack.test.ts`, `lanes.test.ts`: `order` slots match the drawn boxes.
- `slotReorder.test.ts`; `EffectEditor.reorder.test.tsx` reporting "Reorder".
- `EffectEditor.reorder.browser.test.tsx`: a real drag under rack; the insertion bar's place.
- `apps/chart/src/pipeline/pipeline.browser.test.tsx`: switch look, reorder, undo.

## 3. Multiple pages

### What the user sees

A strip of page tabs under the canvas: click a tab to fit the view to that page, double-click to
rename, drag to reorder, + to add, context menu to delete or set the size. Page › Page Setup picks a
size (Letter, Legal, Tabloid, A4, A3, each portrait or landscape, or custom). Page Up and Page Down
step between pages. Pages sit side by side in one world, as `core/pages` already lays them out, so
one scene, one view, and one history serve them all. The tab of the page most of the view shows is
lit.

A shape belongs to the page its bounds overlap most (`pageOfBounds`). Reordering or resizing pages
moves each page's shapes with it. Deleting a page deletes what is on it and every connector attached
to that, as one undo entry.

**Connectors may cross pages and draw across the gap (2026-10-19)**: in one world nothing stops
them, and off-page reference markers are third-arc work. **Shapes in the gap belong to no page and
stay put when pages move (2026-10-19).**

### Core foundation: scene document values

Pages, page layout, and later the theme are document state that is not a node. Core has no place
for it: `SerializedScene` holds layers and nodes only, and `registerOp` records history without
serializing.

- `packages/core/src/core/scene/docValues.ts`: `Scene.doc: SceneDoc` with `get<T>(key)`,
  `set(key, value | undefined)`, and `keys()`. A `set` is a scene mutation: undoable, part of an
  enclosing `batch`, elided when the value is deep-equal, and heard by `subscribe`.
- `SerializedScene.doc?: Readonly<Record<string, unknown>>` (JSON values only; `version` stays 1,
  since the field is additive), `docFromSnapshot(json)` beside `nodeSpecsFromSnapshot`, and
  `useScene({ doc })` for the initial values.
- Keys are namespaced by owner: `core:pages`, `diagram:theme`.

### Engine surface

- `packages/core/src/core/pages/pageEdits.ts`, exported from `barrel/viewport.ts`:
  `PagesDoc { pages: Page[]; layout?: PageLayoutOptions }`, `PAGES_DOC_KEY = 'core:pages'`,
  `pagesOf(scene) → PagesDoc | null`, `pageMembers(scene, placed) → Map<pageId, NodeId[]>` (roots
  only; nodes with `dependsOn` follow their dependencies), and
  `setPages(scene, next, label)`, which moves each page's members by the change in their page's
  place and writes the doc value in one batch. `addPage`, `removePage`, `movePage`, `resizePage`,
  and `renamePage` are built on it. Members move with their descendants (piece 5 relies on this).
- `PageTabs` in `packages/ui/src/components/PageTabs/`, built on the existing `Tabs`, generic over
  any page list, with its own stories file.
- `usePaperLayer` (`apps/shared/editor/src/paperLayer.ts`) takes the placed pages instead of one
  size; draw passes its single page through the same function.

### Save, load, undo

The page list saves in the scene's `doc` under `core:pages`; a chart saved before this piece has
none and opens as one page of `CHART_PAGE`'s size. Every page edit is one history entry holding the
doc value and the member moves together. `replaceChart` (`apps/chart/src/chartPersistence.ts`) sets
the doc values in the same batch as the nodes.

### Tests

- `docValues.test.ts`: set, undo, redo, elision, batch, `toJSON` round trip.
- `pageEdits.test.ts`: reorder moves members; resize keeps page-relative places and shifts later
  pages; remove deletes members and their connectors in one entry; gap nodes stay.
- `PageTabs` test and stories; `apps/chart` test that a v1 file without pages loads as one page.
- Chart browser test: add a page, draw on it, reorder tabs, undo, save and reload.

## 4. Themes

### What the user sees

Format › Theme picks a document theme; the page, every shape, connector, label, container, and lane
recolor at once, and one undo puts them back. A new right-hand Format sidebar holds a Style picker
for the selected shapes or connectors, built on `PropertyPanel`, listing the theme's roles (Default, Accent, Muted, Positive, Warning,
Negative) as swatches. A color the user set by hand survives a theme change.

### The model

**A theme writes literal colors into the scene; nothing resolves a theme at paint time
(2026-10-19).** Every reader of the scene (the renderer, SVG export, hit-testing, another app
opening the file) keeps working with no theme in hand, and the ownership rule is the one layout
already uses for waypoints (`laidOut`): the theme owns a color until the author sets it.

### Engine surface (`packages/diagram/src/theme/`)

- `types.ts`: `DiagramTheme { id; name; roles: Record<string, NodeStyle>; defaultRole; edge:
  EdgeStyle; label: { fill; font? }; container: NodeStyle; lane: { header: NodeStyle; bodies:
  NodeStyle[] }; page: string; font: { family; size }; series: string[] }`, reusing `NodeStyle` and
  `EdgeStyle` from `fromData.ts`. `DIAGRAM_ROLES` names the shared role ids.
- `themes.ts`: `DIAGRAM_THEMES`: `paper` (chart's current ink on white, so existing charts are
  unchanged), `night` (today's dark defaults in `effect/draw.ts` and `lanes.ts`, so `EffectChart`
  is unchanged), `blueprint`, `pastel`, and `mono`.
- `fromTokens.ts`: `diagramThemeFromTokens(read: (token: string) => string)` builds a theme from
  resolved `--wzl-*` values, so a diagram can match its host's chrome. It takes a reader, so
  diagram gains no dependency on `@weasel-js/theme`.
- Traits: `style?: string` (a role id) on `DiagramNode` (`trait.ts`) and `DiagramEdge`
  (`edgeTrait.ts`), and `ownStyle?: readonly StyleField[]` listing what the author set by hand.
- `themeWrites(scene, theme) → Map<NodeId, data>` (pure) and `applyDiagramTheme(scene, theme,
  label)`, which writes them and the `diagram:theme` doc value in one batch. Body text rows take
  their role's text color and the theme's font family; a row's own size stays.
- `setDiagramStyle(scene, ids, role)`; a hand edit of a fill or stroke adds to `ownStyle`.
- Inserts read the theme: `useStencilInsert`, `diagramPorts`, `useConnectorTool`, and
  `editEdgeLabelAction` already take a style (735990028, 2026-10-19), and chart builds those
  styles from the current theme. `CHART_NODE_STYLE`, `CHART_EDGE_STROKE`, `CHART_LABEL_FILL`, and
  `CHART_PAGE_COLOR` in `chartDocument.ts` are deleted.
- Data-backed: `DiagramSceneOptions.theme` resolves `DataNode.style` roles in `diagramScene`; the
  effect looks take `theme` in their options and read `sceneStyles`, lane fills, and `typeColors`'
  palette (`series`) from it. Type colors stay the look's, drawn from the theme's series.

### Save, load, undo

The `diagram:theme` doc value holds a built-in theme's id or a whole custom `DiagramTheme`. Nodes
hold literal colors, so a file opens right even where the theme is unknown. Applying a theme is one
entry; setting a role is one entry.

### Tests

- `themeWrites.test.ts`: `ownStyle` respected; rows, edges, labels, containers recolored.
- `theme.scene.test.ts`: one undo restores every color and the doc value.
- `fromTokens.test.ts`; `fromData.test.ts` role resolution; the effect looks under `night` give
  today's colors exactly.
- Chart browser test: switch theme, read the page fill and a shape fill back from the canvas
  pixels, undo.

## 5. Containers and swimlanes

### What the user sees

The Shapes panel gains Container, Pool (rows), and Pool (columns).

- **Container**: a titled box. Dragging a shape into it lights the container and makes the shape
  its member on release; dragging the container moves its members and their connectors; dragging a
  member out releases it; resizing the container leaves members where they are. Deleting a
  container deletes its members (it is structural, like a Cmd+G group); Arrange › Release members
  removes the box and keeps them.
- **Pool**: a header and a stack of lanes. A new pool has two. "Add lane" at the end of the stack
  adds one; dragging a lane's header reorders lanes; dragging the boundary after a lane resizes it;
  double-clicking a header renames it. Shapes dropped in a lane become its members.

A click selects the innermost shape under the pointer; a click on a container's header or empty
interior selects the container.

### Engine surface (`packages/diagram/src/containers/`)

- `trait.ts`: `DiagramContainer { role: 'container' | 'pool' | 'lane'; header?: { side: 'top' |
  'left'; size: number } }` under `data.diagram.container`, read with `diagramContainerOf`. A
  container is a core `ContainerNode`; its title is a text child in the header, as a body's rows
  are.
- `containerLayout.ts`: `diagramContainerLayout()`, a free-placement `LayoutStrategy` whose
  `dropRegion` is the body below the header, whose `acceptsDrop` admits participants and refuses
  lanes and pools, and whose `releaseDrop` is `null`. Registered as `diagram:container` through
  `withDiagramRegistry` (`edge.ts`), so it round-trips by key.
- `laneStack.ts`: `laneStackLayout({ axis })`, registered as `diagram:pool-rows` and
  `diagram:pool-columns`. Lanes stack along the axis after the header and stretch across it;
  `getDropTargets` offers the gaps between lanes to a dragged lane; it accepts only lanes. **A
  pool's size along the stack is the sum of its lanes; its cross size is the author's
  (2026-10-19).**
- `laneBoundaryLayer.ts` and `LANE_RESIZE_ACTION_ID = 'diagram.resizeLane'`, an affordance and
  action in the edge-end pattern, with a swappable commit.
- `containerStencils.ts`: `CONTAINER_STENCILS` and `containerBuild(stencil, bounds, style)`,
  inserted through the same `insert` dep path as `stencil.ts`; `addLane(scene, pool, index?)` and
  `releaseMembers(scene, id)`.
- **`diagramCanDropInto(scene)`**: admits containers and lanes (and a pool for a lane), and refuses
  stencil bodies, edges, and labels.

**Core foundations.**
- A **drop filter**: an optional `canDropInto(parent, ids)` dep in
  `packages/core/src/interactions/actions/depSchema.ts`, consulted by `resolveDropTarget`
  (`move/commit/reparent.ts`) and the layout drop pass (`move/layout/dropPass.ts`). Today any
  container under the pointer takes a `reparentOnDrop` drop, which would put a shape inside a
  stencil body's rows.
- **Layout passes carry descendants.** Under absolute poses a layout writing a child container's
  pose leaves that child's own children behind, so a restacked lane would lose its members.
  `layoutPass.ts` translates each laid-out container's descendants by its delta, reusing
  `landedDescendants.ts`, which already does this for drags. `setPages` (piece 3) uses the same
  helper.
- Container resize must leave members put. If core's resize remaps a container's descendants (not
  yet checked), the fix is a `carriesChildren(id)` option beside `resizable` in
  `resize/options.ts`, and `diagramResizable` answers it.

**Decisions (2026-10-19).**
- Connectors stay at the scene root, drawn above every container, whatever their ends are inside:
  their geometry derives from their ends, and a root edge never needs reparenting.
- Lanes take no connectors: a lane is a region, not a thing in the process. Containers and pools do.
- Data-backed containers (`DiagramData`) are third-arc work, because `DiagramView` has no resize
  reporting yet and containers need it first.

### Save, load, undo

Containers are scene nodes with layout registry keys and save through `toJSON`. A drop into or out
of a container is part of its move's history entry; add lane, resize lane, reorder lanes, and
release members are one entry each.

### Tests

- `containerLayout.test.ts`, `laneStack.test.ts`: drop regions, acceptance, stacking, gaps.
- `containers.scene.test.ts`: drop in and out reparents in one entry; moving a container moves
  members and translates their connectors' waypoints (`waypointFollower`); resize leaves members;
  delete takes members, release keeps them; a restack moves later lanes' members.
- Core: `reparent.test.ts` and `dropPass` tests for `canDropInto`; `layoutPass` descendant carry.
- `containers.browser.test.tsx`: a real drag into a container and into a lane, lane header reorder,
  boundary resize. Chart browser test: build a pool, add shapes, save and reload.

## 6. Obstacle-avoiding routing

### What the user sees

Connectors drawn with the connector tool route around shapes: orthogonal, with few bends, a
clearance from every shape, and parallel runs spread apart instead of drawn on top of each other.
While a shape is dragged, the connectors near it reroute live. Format › Connector › Around shapes /
Orthogonal / Straight / Curved sets the selected connectors' router; the connector tool defaults to
Around shapes, and connectors saved before this piece keep the router they have.

### The model

**Routes are computed at edit time and stored on the edge (2026-10-19).** `DiagramEdge` gains
`route?: readonly Vec2[]`, the router-owned bends between the ends, beside the author's `waypoints`
and layout's `laidOut`. A derive-time router cannot see obstacles (`Router` gets only the two ends
and the waypoints), and an edge whose path read every shape would invalidate on every move. A
stored route also opens in any reader with no router, and undo restores it exactly.

`avoid` joins `ROUTERS` in `edge.ts`. `RouteRequest` gains `route?`, and `edgeDerivePath` passes
it, and `endAims` aims each end at the route's first and last bend when there is one. The `avoid`
router draws `[from.point, ...route, to.point]` when the route is still valid (its first segment
leaves along `from.normal`, its last arrives against `to.normal`, and it passes every authored
waypoint in order) and otherwise falls back to `orthogonal` through the stops, so an end moved by
something that did not reroute still draws sensibly.

Authored waypoints are stops: the router routes each leg between consecutive stops. **Dragging a
segment of an `avoid` connector pins only that segment**, writing its two ends as authored
waypoints, and the rest stays the router's (2026-10-19).

### Obstacles

| Thing | Obstacle to a connector when |
|---|---|
| A shape (participant) | always, except a port stub leaving or entering it |
| A container or pool | neither end is inside it |
| A lane body | never |
| A lane or pool header | always |
| The connector's own end shapes | always, beyond the port stub |
| Edge labels | never in this arc |

An obstacle is its outline's bounds grown by `clearance` (default 10 world units). Obstacles on
any page count; the search is bounded by the window below.

### Algorithm (`packages/diagram/src/avoid/`)

An orthogonal visibility graph searched with A* on direction-carrying states, then a nudging pass.

1. **Ports.** Each end leaves its port along the normal by `clearance + 1` to an exit point. An end
   with no port (dynamic glue) offers every port facing outward as a source or target, so the
   search picks the side.
2. **Grid lines** (`grid.ts`). Candidate x lines: every inflated obstacle's left and right edge,
   every exit point's and stop's x, and the midline of each gap between two facing obstacles wider
   than twice the clearance. Likewise y. Only lines inside the search window count: the box of the
   leg's stops grown by 400 world units, doubled on failure up to the bounds of every page.
3. **Lazy graph.** Vertices are line crossings not inside an inflated obstacle; a step to the next
   crossing on the same line is allowed when the segment does not cross an obstacle's interior.
   Nothing is materialized: blockage is asked of a uniform spatial hash of inflated obstacles
   (128-unit cells) as A* expands (`obstacles.ts`).
4. **Search** (`search.ts`). State is (vertex, heading). Cost is length plus `bendPenalty` per turn
   (default 40) plus `crossPenalty` per crossing of another connector's stored route (default 20,
   from a spatial hash of route segments). The heuristic is Manhattan distance plus `bendPenalty`
   times the fewest turns still needed given the heading and the target's required arrival
   direction, which never overestimates. A binary heap orders the open set. Legs run in order, each
   starting with the heading the last ended on, so a turn at a waypoint is charged too.
5. **Fallback.** No path within the whole window draws `orthogonal` through the stops.
6. **Nudging** (`nudge.ts`). Collinear overlapping segments of different connectors in one channel
   form a bundle, ordered by where each comes from and goes so that they do not cross, and are
   spread `spacing` apart (default 8) about the channel's middle, clamped to the free width. A
   segment meeting a port moves only its far end; the port stub stretches. Then `simplifyStops`.

### Incremental behavior

`router.ts`: `createAvoidRouter(options)` holds the obstacle index, the route-segment index, and
the last routes, and `update({ obstacles, edges }) → Map<edgeId, Vec2[]>` reroutes only the dirty
set: connectors attached to a changed shape, connectors whose route meets a changed obstacle's old
or new inflated bounds, connectors whose stops or router changed, and new ones.

- **During a drag** (a transform follower, `useTransformFollower` in core), each frame reroutes attached connectors
  first and then the rest of the dirty set within a 4 ms budget; any it does not reach keep last
  frame's route and catch up next frame. No nudging, no crossing penalty, and no work when the
  pointer moved less than one screen pixel.
- **On commit**, through a scene edit pass, the whole dirty set is rerouted with nudging and the
  new `route` values join the edit's own history entry.
- **On load**, nothing reroutes: stored routes draw as they are.
- **Under layout**, `routeWrites.ts` writes no waypoints to an `avoid` connector (it still names
  ports), and the edit pass routes it after the layout's batch (2026-10-19), so layout bends never
  become stops.

**Core foundation: scene edit passes.** `packages/core/src/core/scene/editPass.ts`:
`scene.addEditPass(pass) → dispose`, where `pass(summary: SceneEditSummary) → Op[] | null` hears
each live batch's added, removed, posed, re-parented, and data-changed ids once the batch's own
mutations and the arrival handler have run. Its ops join the same history entry; passes do not
re-trigger on their own writes; undo, redo, and history replay never run them. This catches every
edit, not only drags: an insert on top of a route, a delete, arrow-key nudges, a paste, a panel
edit, a data-backed reconcile.

Diagram wires both halves with `useAvoidRouting(scene, options)` (edit pass plus follower) and
`installAvoidRouting` for a host without React. A data-backed `DiagramView` takes
`router="avoid"`, holds one `createAvoidRouter` across rebuilds, and fills routes as `diagramScene`
builds specs. **A data-backed host never stores or hears routes (2026-10-19)**: they derive from
its data, and a reported route would be a second source of truth.

### Performance budget

Measured by `packages/diagram/src/avoid/avoid.bench.ts`, run on the fleet with `--kind bench`,
printing each case as it finishes.

| Case | Diagram | Budget |
|---|---|---|
| Drag frame | 200 shapes, 300 connectors, up to 20 dirty | 4 ms |
| Commit | same, up to 50 dirty, with nudging | 30 ms |
| Full route | 500 shapes, 800 connectors | 150 ms |

### Save, load, undo

`route` saves in the edge trait; a file saved before this piece has none and draws its routers as
before. A reroute is never its own history entry: it is part of the edit that caused it.

### Tests

- `grid.test.ts`, `obstacles.test.ts`: lines, window growth, blockage.
- `search.test.ts`: straight when clear; around one box; fewer bends win at near-equal length;
  arrival against the port normal; waypoints in order; the container rule; a property test over
  random layouts that no segment enters any obstacle it should avoid.
- `nudge.test.ts`: bundles separate, in an order that does not cross, never into an obstacle.
- `router.test.ts`: the dirty set is exact and untouched connectors keep identical routes.
- `editPass.test.ts` in core: one entry, no re-trigger, not run on undo or replay.
- `avoid.scene.test.ts`: moving a shape onto a route reroutes in that move's entry; undo restores
  the route; an insert onto a route reroutes; a stale route falls back to `orthogonal`.
- `avoid.browser.test.tsx`: a real drag; the preview path changes across frames and settles to the
  committed route. Chart browser test: draw, drag a shape across a connector, undo.

## Third arc (not designed)

- Off-page reference markers for connectors that cross pages, and export of one page.
- Containers and swimlanes in data-backed `DiagramData`, after `DiagramView` reports resizes.
- Edge labels as routing obstacles, and labels that dodge each other.
- Line jumps (hops) where connectors cross.
- Pipeline-mode groups as editable containers; waypoint editing under the `rack` and `lanes` looks.
- Theme editing in the app (a theme builder), beyond picking and assigning roles.
- Importing and exporting other diagram tools' files, and running a pipeline, still out from the
  first arc.
