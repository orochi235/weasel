# weaselchart (`apps/chart`), second arc — design

**Pieces 4 and 6 unbuilt as of 2026-10-19.** Pieces 1, 2, 3, and 5 have landed; the diagram README and `docs/concepts.md` describe them.

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
| 4 | Themes | — | — |
| 6 | Obstacle-avoiding routing | scene edit passes | — |

The suggested order holds.

Every piece also: writes `patch` changesets; keeps files under 400 lines and functions under 120
(`npm run check:size`); exports only public surface to the app; updates the diagram README's
editing section and `docs/TODO.md` in its merge; and, when it merges, deletes its own section of
this doc (the doc is deleted with the last piece).

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
