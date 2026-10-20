# @weasel-js/diagram

Node-link diagramming for weasel — flowcharts, pipelines, code-flow diagrams,
simple visual programming.

Any scene node becomes a diagram participant by carrying the `DiagramNode`
trait; nothing has to be authored through this package to take part. Ports
default to anchors on the node's own bounds, so a node needs to say nothing to
be connectable. Edges are ordinary scene nodes whose geometry derives from the
two they join, so they re-route whenever either end moves. An optional body
builder composes ordinary scene nodes for nodes that should *look* like a
flowchart box.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/diagram).

## Install

```sh
npm install @weasel-js/diagram
```

## Usage

```ts
import { portsOf, COMPASS } from '@weasel-js/diagram';
```

### Building a body

A participant that should read as a flowchart box gets one from `buildBody`:
the container carrying the trait, plus an ordinary text node per row, so the
kit's own text painter draws them and editing and styling work unchanged.

```ts
const { specs } = buildBody<Data, 'main', Pose>(
  { outline: 'diamond', rows: [{ kind: 'label', text: 'ready?' }] },
  { x: 40, y: 40, width: 150, height: 56 },
  {
    id: 'check',
    layer: 'main',
    body: (trait) => ({ diagram: trait, stroke }),
    row: (text) => (text === '' ? null : { text }),
  },
);
```

The rows measure a floor and the authored pose is grown to clear it, never
shrunk — so resize, align, distribute, snapping and undo need no special case.

A perimeter port can carry a `label`, or be named in `portLabels` (on a
`BodySpec` or a `DataNode`) by port id, which labels the default compass ports
without redeclaring them. The label is drawn outside the node beside the port's
wire; layout lays the node out with room for it, and a group's box takes it in.

### Making ports grabbable

`diagramPorts` returns the two halves of the connect gesture. Attach the layer
with `registerLayer` — the only route the kit hit-tests — and pass the
contribution as `ambient`:

```tsx
const { layer, contribution } = useMemo(() => diagramPorts({
  participants: sceneParticipants(scene),
}), [scene]);

const canvasRef = useRef<SceneCanvasApi | null>(null);
useEffect(() => canvasRef.current?.registerLayer(layer), [layer]);

return <SceneCanvas ref={canvasRef} scene={scene} ambient={[contribution]} />;
```

Dragging one port onto another authors an edge. Which pairs may be joined is
`canConnect`, which defaults to "a port may not join itself, and two ports that
both declare a `type` must declare the same one".

A port may name other places it can sit, in `sites`. An edge meeting it takes
whichever place faces the edge's next point — its first waypoint, or the other
node — so a decision's second exit can leave by its top or its bottom,
wherever its wire goes. `portSitesOf` resolves every place; anything else that
shows a port, the connect affordance included, shows it at `at`.

### Connecting to a shape's body

An edge may end on a shape rather than on one of its ports. `DiagramView` takes
it with `connectBodies`; on a bare canvas, set `bodies` on the connect action
and add the connector tool, which starts an edge from whatever shape the press
lands on.

```tsx
<DiagramView specs={specs} onConnect={add} connectBodies />

const participants = useMemo(() => sceneParticipants(scene), [scene]);
const connector = useConnectorTool({ participants });
```

An end is a `ConnectEnd`: a port, or a body (`isBodyEnd` tells them apart). A
data edge ended on a body has no `fromPort` or `toPort`.

### Reconnecting an edge end

Set `onReconnect` and a selected edge shows a handle at each end. Dragging one
onto another port, or with `connectBodies` onto a shape, reports the move and
changes nothing; update the data edge to keep it.

```tsx
<DiagramView
  specs={specs}
  onReconnect={({ edge, end, node, port }) => setEdges((all) => all.map((e) => edgeIdOf(e) !== edge ? e
    : end === 'from' ? { ...e, from: node, fromPort: port } : { ...e, to: node, toPort: port }))}
  connectBodies
/>
```

`edge` is `edgeIdOf` the data edge, so give edges an `id` when you want it to
survive a reorder.

### Editing a route

A selected edge shows handles along its route as well as at its ends.

| Router | Handles | Drag | Double-click |
|---|---|---|---|
| `straight`, `bezier` | a dot on each waypoint; a smaller hollow dot in the middle of each leg | a dot moves its waypoint; a hollow dot inserts one there | a dot removes its waypoint |
| `orthogonal` | a bar in the middle of each segment | slides the segment across its axis; a segment touching a port gets a jog, so the port end stays square | straightens a jog away, when a neighbor touching no port can slide into line |
| `avoid` | a bar in the middle of each segment | slides the segment and pins only it: its two ends become waypoints, and the router keeps the rest | unpins it, dropping the waypoints at its ends |

A dragged handle snaps into line with the stops beside it and with a port's
axis within 6 screen pixels, and a guide shows the alignment. Escape cancels.
A double-click that would remove nothing falls through, to label editing say.

`DiagramView` takes `onEditRoute`, which reports the edge's new waypoints and
changes nothing: store them as the data edge's `waypoints` and clear its
`routed`. On a bare canvas, `diagramWaypoints` returns the handle layer to
register — after the port layer and before the edge-end layer — and the
contribution to pass as `ambient`, which also carries the `diagram.resetRoute`
command that clears the selected edges' waypoints. The default commit writes
the scene in one undo entry, and the route is the author's from then on, so
layout leaves it alone.

```tsx
<DiagramView
  specs={specs}
  onEditRoute={({ edge, waypoints }) => setEdges((all) => all.map((e) => edgeIdOf(e) !== edge ? e
    : { ...e, waypoints, routed: undefined }))}
/>

const route = useMemo(() => diagramWaypoints({ participants, selected }), [participants, selected]);
```

An orthogonal segment drag writes every bend of the new route as a waypoint,
since the router recomputes elbows between stops. The math is exported on its
own: `routeHandles`, `dragVertex`, `insertWaypoint`, `removeWaypoint`,
`dragSegment`, `removeSegment`, `pinSegment`, `unpinSegment`, and `simplifyStops`.

Waypoints ride along with a move that carries both of an edge's ends by the
same offset: `waypointFollower(scene)` is a transform follower, added to the
canvas with core's `useTransformFollower`. An edge with one end moved keeps its
waypoints where they are.

### Routing around shapes

The `avoid` router draws connectors around shapes: orthogonal, with few bends,
10 world units clear of every shape, and parallel runs spread 8 apart. Routes
are computed when the scene is edited and stored on the edge as
`diagram.route`, the bends between its ends, so a saved file draws them with no
router running and undo restores them exactly. A stored route that no longer
fits its ends, after something that did not reroute moved one, draws as
`orthogonal` instead.

`useAvoidRouting(scene)`, mounted as a child of `<SceneCanvas>`, reroutes what
each edit disturbed — a move, an insert onto a route, a delete, a paste, a
panel edit — in that edit's own undo entry, and while a shape is dragged it
reroutes the connectors near it each frame. Installing it reroutes nothing.
`installAvoidRouting(scene)` does the same for a host without React, and hands
back the drag's transform follower.

```tsx
function Routing({ scene }) {
  useAvoidRouting(scene);
  return null;
}

<SceneCanvas scene={scene} /* … */>
  <Routing scene={scene} />
</SceneCanvas>
```

What a connector routes around:

| Thing | In the way when |
|---|---|
| A shape | always, beyond the stubs where a connector leaves or meets it |
| A container, pool, or group box | neither end is inside it |
| A lane's body | never |
| A lane's or pool's header | always |
| An edge label | never |

Authored waypoints are stops the route passes in order. Layout names an
`avoid` connector's ports and writes it no waypoints. `diagram.router.avoid`,
`.orthogonal`, `.straight`, and `.bezier` (`SET_ROUTER_ACTION_IDS`, carried by
`diagramWaypoints`) set the selected connectors' router; leaving `avoid` drops
the stored route.

A data-backed `DiagramView` takes `router="avoid"`: it routes every edge of
each new `specs` around the shapes, holding one router across them so each
reroutes only what changed, and never reports a route. `createSpecRouter` is
that step on its own. The search itself, `createAvoidRouter`, reads plain boxes
and ports and is in `@weasel-js/diagram/layout`.

### Edge labels

`onEditLabel` reports a double-click on an edge. `edgeLabelSpec` builds the
label node that rides the edge's route, and `editEdgeLabelAction` creates one
or edits the existing one in place.

```tsx
<DiagramView specs={specs} onEditLabel={(edge) => startEditing(edge)} />

const spec = edgeLabelSpec(edgeId, 'yes', { layer: 'diagram' });
```

`labelSize` is the box a label's text takes. Both routes size with it, so a
label built from data and one the action creates come out the same size.

### Overlays and hover

`overlays` holds DOM against a node, a group or an edge, and places it again
after every paint, so it follows pans, zooms, resizes and layout. A side
placement uses geom's `placeRect` inside the view, flipping to the far side
when the near one has no room; the default centers it on the target. An
edge's place is the midpoint along its route.

```tsx
<DiagramView
  specs={specs}
  pickEdges
  onHover={setHovered}
  overlays={[
    ...(hoveredEdge ? [{ target: hoveredEdge, content: <button onClick={insert}>+</button> }] : []),
    ...(picked ? [{ target: picked, placement: { side: 'right', align: 'start' }, offset: 8, content: <Card /> }] : []),
  ]}
/>
```

`onHover` reports the node, group or edge under the pointer, and `null` when
there is none or the pointer leaves the canvas, which it also does when the
pointer moves onto an overlay. Edges answer only with `pickEdges`. For DOM
the view does not hold, `rectOf(id)` on the ref gives a target's client rect
and `subscribeFrame` says when to read it again.

### Reordering a group's members

A group with `reorder: 'x' | 'y'` lets `onReorder` drag any of its members
along that axis; a member that is a group carries everything inside it. The
other members slide into the places they would take, and the release reports
the new order without moving anything. With a member picked, Alt and an arrow
key steps it one place. `layered` keeps a reorderable group's members in the
order given across every rank, so writing the order back is all it takes.

```tsx
const data = { nodes, edges, groups: [...rows, { id: 'layers', members: order, reorder: 'y' }] };
<DiagramView specs={diagramScene(data)} onReorder={({ order }) => setOrder(order)} />
```

### Stencils

A `DiagramStencil` is a palette entry: an id, a label, an outline and a default
size. `FLOWCHART_STENCILS` has the basic flowchart symbols. `useStencilInsert`
makes the canvas's `insert` dep build them, and `useStencilTool` gives each a
tool that places one on a drag. A click places nothing; to place one at a
point, call the `insert` dep's `commit` with a zero-size box there and the
stencil's kind, and the body comes out at the stencil's size.

```tsx
useStencilInsert(FLOWCHART_STENCILS, { layer: 'diagram' });
const decision = useStencilTool(FLOWCHART_STENCILS[1]);
```

A drop from your own palette goes through the canvas's `ingestion` handlers:
a handler gets the drop's world point as `ctx.point` and calls
`ctx.insert.commit`. Elsewhere, `SceneCanvasApi.clientToWorld` turns a client
point into a world one. `useStencilInsert` hands any kind that is not a stencil's to
the `insert` dep it displaced, so core's rect, ellipse and text tools keep working.

### Containers and pools

A container is a titled box that holds other shapes; a pool is a header and a
stack of lanes, each holding shapes. Both are core `ContainerNode`s carrying a
`container` trait (`diagramContainerOf`): a role of `container`, `pool`, or
`lane`, and a header. A region's title is a text child named
`<id>/title`, so double-clicking a header renames it.

| What the user does | What happens |
|---|---|
| drags a shape into a container's body or a lane | the shape becomes its member, in the move's undo entry |
| drags a member out | it leaves, to the top level or the container under the drop |
| drags a container | its members, and the waypoints of connectors between them, go with it |
| resizes a container | its members stay where they are |
| deletes a container | its members go with it; Release members keeps them |
| drags a lane by its header | the lanes reorder, members and all |
| drags the boundary after a lane | that lane resizes and the pool grows or shrinks with it |
| clicks the button past the end of a pool | a lane is added at the end |

`CONTAINER_STENCILS` offers Container, Pool (rows), and Pool (columns); pass it
as `useStencilInsert`'s `containers` and give each a `stencilTool`. Their glyphs
are in the `diagram` icon namespace, whose table is `@weasel-js/diagram/icons`;
an app without the icons build plugin registers it beside the kit's. A stencil
drawn inside a container or a lane becomes its member (`diagramDropParentAt`).
`containerBuild` returns the ops on their own, and `addLane` and
`releaseMembers` are the edits as functions.

What a region admits is the `canDropInto` dep's call, and `diagramCanDropInto(scene)`
is the one for a diagram: containers and lanes take shapes and containers, a
pool takes only lanes, and a stencil body, an edge, or a label takes nothing.
`diagramContainers` returns the lane layer to register and the contribution to
pass as `ambient`, which carries the boundary drag (`diagram.resizeLane`), the
add-lane click (`diagram.addLane`), and the `diagram.releaseMembers` command.
The two lane gestures take a swappable commit.

```tsx
useStencilInsert(FLOWCHART_STENCILS, { containers: CONTAINER_STENCILS });
useDepSource('canDropInto', () => diagramCanDropInto(scene));
const containers = useMemo(() => diagramContainers({ scene, selected }), [scene, selected]);
```

The layouts register by key through `withDiagramRegistry`, so a saved scene
finds them again: `diagram:container`, `diagram:pool-rows`,
`diagram:pool-columns`, `diagram:lane-rows`, and `diagram:lane-columns`.
`diagramContainerLayout` places members freely under a header, and
`laneStackLayout` stacks a pool's lanes in the order they sit; a pool's size
along the stack is the sum of its lanes. Lanes take no connectors, and
connectors stay at the top level, drawn above every container. `DiagramView`
does not build containers from data yet.

### Themes

A `DiagramTheme` is a document's colors and face: a style per role (`DIAGRAM_ROLES`: Default,
Accent, Muted, Positive, Warning, Negative), the connector and label colors, the container and
lane looks, the page color, a font, and a `series` of colors for things it cannot name ahead,
such as a look's value types. `DIAGRAM_THEMES` ships `paper`, `night`, `blueprint`, `pastel`, and
`mono`; `diagramThemeFromTokens(read)` builds one from a host's resolved `--wzl-*` values.

A theme writes literal colors into the scene, so whatever draws or exports the scene needs no
theme. A shape or connector names its role in its trait's `style`, and lists the colors its
author set by hand in `ownStyle`; a theme leaves those.

```ts
applyDiagramTheme(scene, DIAGRAM_THEMES.blueprint);          // one undo entry, saved as `diagram:theme`
setDiagramStyle(scene, selection.get(), 'warning');          // name a role, and recolor in it
setDiagramColor(scene, selection.get(), 'fill', '#ffcc00');  // by hand: survives the next theme
const theme = diagramThemeOf(scene, DIAGRAM_THEMES.paper);   // the scene's theme, or a fallback
```

`themeWrites(scene, theme)` is the pure half: the new `data` for every node the theme recolors.
New shapes and connectors take the theme from whatever inserts them: pass `roleStyle(theme)` and
`themeFont(theme)` to `useStencilInsert`, `themeEdgeStroke(theme)` as a connect action's
`edgeStroke`, and `themeLabelStyle(theme)` and `theme.label.fill` to `editEdgeLabelAction`.
`diagramScene` takes `theme` too, drawing each `DataNode` in its `style` role, and the effect
looks take one in their options (default `night`, which draws them as they always were).

### Laying it out

`layered`, `tree`, `force` and `chain` are plain functions of the graph. Each
hands back the new top-left for every node that **moves** — a node already
standing where the layout wants it is absent, so re-running a layout on an
unchanged diagram writes nothing at all.

```tsx
useAction(useMemo(() => createLayoutAction<Pose>({
  source: sceneParticipants(scene),
  algorithm: 'layered',
}), [scene]));
```

The action rebuilds the graph from the scene on each press and writes the whole
move as one undo entry. Three rules keep a re-layout from scrambling a diagram
someone has arranged: no RNG anywhere, within-rank order seeded from where the
nodes already sit, and a node carrying `pinned: true` that nothing moves.

The first pinned node anchors the layout. Under `layered`, every other pin
keeps its place across its rank, with the rest of the rank moved clear of it,
past it if there is no room beside it. A pin's rank band slides or deepens to
cover it, the gaps toward other pinned ranks shrink to make room, and a group's
column moves or widens to take in its pinned members, never over a node outside
the group. A pin is left out only when no arrangement fits: its band would come
nearer another pinned rank's than the ranks between them allow with every gap
at a quarter of `rankGap` (plus group insets), or a group's box would cover a
pin outside the group. In practice that is a pin dragged level with, or past,
the rank beside it. Such a pin stays put without the layout being built around
it; `layeredPlan` names it in `unheld`.

`force` is the exception to the second half of that: it is an iterative
relaxation seeded from the current positions, so re-running it keeps relaxing.

`layered` turns around any edge that closes a cycle, then gives each node a
rank that keeps the total edge length as short as it can (`ranksByLength`,
network simplex), so a node with no inputs sits beside what it feeds rather
than in the first rank. It lines each node up with its neighbors across the
ranks (Brandes–Köpf), lining up the two ports an edge joins rather than the two
centers. An edge that spans ranks stands in each rank it crosses, so placement
leaves it room, and an edge whose `GraphEdge.label` gives its label's size gets
a rank of its own between its ends, with room beside its wire as big as the
label. Under `order: 'seeded'` an edge keeps its place in each rank the way a
node does, from where its route crosses that rank now. Under
`order: 'barycenter'` it also reorders each rank to cut crossings, reading each
edge at the port it joins, where `portsOf` puts that port on the node's
outline, so two wires into one node arrive in the order of its ports. A port
with several places is read at the one nearest where the wire's other end
falls among the node's wires on that side. `layeredPlan(graph, opts)`, also reachable as `layered.plan`,
answers with the moves plus each node's rank, each spanning edge's waypoints
and where among them each label's room is, for drawing those edges where their
room was left. `ranksOf` is the plain longest-path ranking, which `chain` uses.

On a live scene the layout action and a live `layered` run write those routes
too, in the same undo entry as the moves: each long edge gets its waypoints,
and its label, when it sits at the default middle, moves into the room left
beside them. Under `layered` each edge's compass ports are named for the way it
runs between ranks, and an end records the port layout named as `laidOut`, the
way a route does; layout names it again on each run while the end names no
port or still names that one. An edge records the waypoints layout wrote as `laidOut`, and
layout rewrites a route only while the edge's waypoints still match them; once
someone moves a bend, the route is theirs and layout leaves it and its label
alone, and keeps no room for it in the ranks it crosses. A layout that routes
nothing, `tree` or `force`, takes layered's routes back off, and anything on a
locked layer stays as it is. A live run writes its routes only when it arrives
with nothing held along the way, since a drag or a `stop` leaves the nodes
somewhere the routes were not laid out for. While it eases, each route it will
write eases with the nodes, shown as the edge's path on the override channel. A layout of your own hands routes
back the same way, by giving its `LayoutFn` a `plan`, which `diagramScene`
reads too.

`chain` stands one run of nodes on a straight line and hangs everything else
beside the chain node it is nearest to, counting edges in either direction. It
is picked like the others, by name: `layout: 'chain'` in `diagramScene`,
`layout('chain')` on a `DiagramView`, or `algorithm: 'chain'` in
`createLayoutAction`. The `chain` layout option lists the ids on the line, in
order; unset, or naming no node of the graph, it is the longest path through
the graph. `chainSide` is
`'after'` (default) or `'before'`: which side of the line the rest hangs on.
Each chain node owns a column as wide as the widest thing hung on it, so
neighbors never share space, and the hung nodes stand in the order of the ports
they connect to. An edge between a chain node and one hung beside it, both ends
naming ports that face each other, runs on a track of its own in the gap
between them, so a fan of them never crosses; the gap grows to keep tracks 12
apart. Groups are ignored.

### From data

`diagramScene` turns plain `{ nodes, edges }` into a laid-out scene, and
`DiagramView` draws it, with pan, zoom and picking:

```tsx
const specs = useMemo(() => diagramScene(data, { nodeStyle }), [data]);
return <DiagramView specs={specs} width={360} height={600} selected={id} onSelect={setId} />;
```

Every box is a `buildBody` body, so a data node takes the same knobs a body
does — `outline`, `rows`, `padding`, `gap`, `verticalAlign`, `ports` — plus `pinned`, a
starting `at`, and a minimum `width`/`height`; `lines` is shorthand for one
label row each. A `slot` row is reserved space, `height` tall and, with a
`width`, that wide and centered; one with an `id` becomes a scene node of that
name, `<node>/<id>`, drawn as an empty frame until you fill it by changing its
data — with `{ image: { src } }`, say. An edge can name `fromPort`/`toPort`, its own `router`,
`waypoints` and `labelPlacement`.

`outline` is `'rect'`, `'diamond'`, `'stadium'`, `'parallelogram'`,
`'trapezoid'` (a demultiplexer: tall at the right, short at the left),
`'hexagon'` (pointed at the left and right, its rows kept between the points), or a
`Path` drawn in a unit square — `(0, 0)` the box's top-left, `(1, 1)` its
bottom-right — which is stretched over the box, so it follows its node as
marks do.

`marks` draws more over a box than its rows. A mark with `d` is SVG path data
in a unit square, stretched over the node's box; it takes `fill`, `stroke`,
`strokeWidth`, `dash` and `opacity`. `diagramScene` throws on path data that
does not parse or draws nothing, naming the node and the mark's index. A mark with `text` is pinned to a point on
the box: `at` is that point as `{ u, v }` fractions of the box, `self` is which
point of the text sits on it (default `at`), and `offset` nudges it in pixels.
Marks move with their node. `DiagramView` registers the painters for outlines
and marks itself; a scene drawn on your own `SceneCanvas` calls
`registerDiagramShape()` once for outlines and `registerMarkShape()` once for
marks, each of which returns its disposer, or they do not paint:

```tsx
{ id: 'gain', marks: [
  { d: 'M0 1 L1 0', stroke: '#c58bff' },
  { text: 'gain', at: { u: 0.5, v: 1 }, self: { u: 0.5, v: 0 }, offset: { x: 0, y: 4 } },
] }
```

`DiagramView` draws ports when `onConnect` is set, or when `ports` says so:
`'connect'` draws them and lets one be dragged onto another, `'show'` draws
them and nothing more, `'none'` hides them. `portOptions` styles them: `shape`
is `'square'` (default) or `'circle'`, `fill` is one fill or a function of the
port (its `type`, say), and `showsPort` picks which of a node's ports show.

Under `layered`, an edge that names neither leaves its source by the face
toward the next rank and arrives at its target's face toward the last; an edge
running back up the ranks does the same the other way round. One that spans
ranks runs through the room `layeredPlan` left for it in each rank it crosses,
so it goes around what lies between its ends — unless an end is a pin
`layeredPlan` could not hold (`unheld`), when it takes the router's own path. An
edge whose pinned ends stand level runs straight between their facing sides, or
around past both when a node stands between them. An
author's own ports and waypoints win. A label's `offset` is the gap between the
route and the label's near side. A label whose edge sets no `labelPlacement`
of its own, or one at `'mid'`, sits in the room layout left it, placed with
`at: { near }`, which stations a label where its route passes nearest a point,
so a bend added or removed elsewhere leaves it where it was.

`groups` draws a box around some nodes, with an optional `label` inside it:

```tsx
diagramScene({ nodes, edges, groups: [{ id: 'ingest', members: ['fetch', 'decode'], label: 'ingest' }] });
```

A group may be a member of another. `layered`, `tree` and `force` keep a
group's members together; `chain` ignores groups but still draws them. Under
`layered` and `tree` each group gets a column on the cross axis that nothing
else enters, in every rank from its first member's to its last, and rank gaps
widen where a box needs the room; `force` pulls a group's members toward each
other and pushes groups apart. The box is an ordinary scene node that depends
on its members and derives its pose from theirs (`groupDerivePose`), so
dragging a member carries the box along. It also depends on the labels of the
wires with both ends inside it, so a long label stays inside the box. It is
never narrower than its label,
and a layout running down or up leaves room for that width. An edge whose
`from` or `to` names a group meets the box, and ranks against the group's first
stage. A scene built
any other way joins in with a node whose trait carries `group` and whose
`dependsOn` lists its members.

Text is sized from character counts unless `measure` is given, so layout runs
without a canvas. The layout defaults to `layered`, picked by name or passed as
any `LayoutFn`; `layoutOptions` merge over `order: 'barycenter'`, and
`'none'` leaves every node at its `at`.

The data owns the
diagram: a new `specs` array is reconciled into the scene the view already
holds (`reconcileSpecs` in core), so the view, the pick and anything moved
since survive it. Editing reports rather than writes —

```tsx
<DiagramView
  ref={view}
  specs={specs}
  onMove={(moves) => setNodes((ns) => withPositions(ns, moves))}
  onConnect={(edge) => setEdges((es) => [...es, edge])}
/>
```

— `onMove` turns on dragging and hears every node a drag or a layout run
moved, and, as its second argument, every edge whose route a layout run
or ports rewrote (`{ id, waypoints, ports }`, `id` being `edgeIdOf` of the
data edge, `ports` the ends whose port the run picked);
`onConnect` makes ports grabbable and hears the edge a connect describes.
Store a move as the node's `at`, with `pinned: true` unless the scene uses
`layout: 'none'`, or the next `diagramScene` lays it out again. Store a route
as the edge's `routed` and its `ports` as `routedPorts`, which `edgeIdOf` does
not read: it is drawn until layout runs again, and stays
layout's to replace, its label keeping the room layout leaves it. `waypoints`
would make it yours, which layout never moves. A run that only rewrote routes
calls `onMove` with no moves.
`onMove` hears only what changes after the view is built. Where the build's own
layout put things, `diagramLayoutOf(specs)` reads off the specs, in the same
shape (`{ moves, routes }`): every node not pinned, and every edge whose route
or ports layout wrote. Store them the same way and the next `diagramScene`
leaves those nodes where they stand and lays out only the new ones, which keeps
a diagram still while its data is edited.
`view.current.layout('layered')` re-runs a layout animated from where the
nodes stand; `'force'` relaxes live. Either way the routes ease with the nodes,
through the ports the run will commit.

`layout()` also takes a `LayoutPlanner`, an object whose `plan(graph, opts)`
answers with a whole `LayoutPlan`, now or as a promise. The run asks it once,
with the graph as it stands, and eases to the answer the way it eases to
`layered`'s, reporting the same moves, routes and ports to `onMove`. While the
answer is on its way, a drag, a change to the data, or another `layout()` call
drops it, since the plan was made for a diagram that is no longer there. A
planner whose promise rejects starts no run, and the reason goes to
`live.onError`, or to `console.error` when that is unset.
`elkPlanner()` from `@weasel-js/diagram-elk` is one: it lays the diagram out
with ELK (the Eclipse Layout Kernel).

```tsx
view.current.layout(elkPlanner({ direction: 'right' }));
```

Labels paint only in a registered font family, and the default is
sans-serif, so call `registerCanvasFont('sans-serif')` once or they render
blank. The view opens fitted to the diagram and fits again when `width` or
`height` changes or a layout run settles, until the user pans or zooms. `minScale` stops the fit from
shrinking a wide diagram past readable; the rest is a pan away.

### Effect charts

`@weasel-js/diagram/effect` draws an effects pipeline: the stages a signal
passes through, what each reads and writes, and where a decision (a stage that
sends the signal one of several ways) sends it.

```tsx
import { EffectChart, type EffectPipeline } from '@weasel-js/diagram/effect';

const pipeline: EffectPipeline = {
  stages: [
    { id: 'in', title: 'Input', kind: 'source', outputs: [{ id: 'out', type: 'audio' }] },
    {
      id: 'gate',
      title: 'Gate',
      inputs: [{ id: 'in', type: 'audio' }],
      outputs: [{ id: 'out', type: 'audio' }],
      params: [{ label: 'threshold', value: '-40 dB' }],
    },
    {
      id: 'verb',
      title: 'Reverb',
      inputs: [{ id: 'in', type: 'audio' }],
      outputs: [{ id: 'out', type: 'audio' }],
    },
    { id: 'out', title: 'Output', kind: 'sink', inputs: [{ id: 'in', type: 'audio' }] },
  ],
  wires: [
    { from: { stage: 'in', port: 'out' }, to: { stage: 'gate', port: 'in' } },
    { from: { stage: 'gate', port: 'out' }, to: { stage: 'verb', port: 'in' } },
    { from: { stage: 'verb', port: 'out' }, to: { stage: 'out', port: 'in' } },
  ],
};

<EffectChart pipeline={pipeline} width={900} height={420} background={{ color: '#10161c' }} />
```

A pipeline is plain data and says nothing about how it is drawn:

| Field | Meaning |
| --- | --- |
| `stages` | The stages, below. |
| `wires` | `{ from: { stage, port }, to: { stage, port }, label? }`, from an output to an input. |
| `groups` | `{ id, label?, members }`: a box around stages and other groups. |
| `types` | `{ [type]: { control?: boolean } }`. A `control` type carries a condition or a modulation rather than the signal, and its wires draw dashed. A type not listed is plain data. |

A stage:

| Field | Meaning |
| --- | --- |
| `id`, `title` | Required. |
| `kind` | `'stage'` (default), `'decision'`, `'source'` or `'sink'`. Any other value draws as `'stage'`. |
| `inputs`, `outputs` | Ports, `{ id, label?, type }`. `type` names a value type; a wire joins ports of one type. A port's `id` is unique among the stage's inputs and outputs together. |
| `params` | `{ label, value }` pairs shown on the box. A decision does not show them. |
| `split` | On a decision that compares a number: `{ input, at }`, the input it compares and the cut points in ascending order. N cuts need N + 1 outputs, lowest band first. |
| `bypassed` | The stage is in the pipeline and switched off; it draws dashed and dim. |
| `data` | Anything else a look wants. The shipped looks do not read it. |

`EffectChart` takes:

| Prop | Meaning |
| --- | --- |
| `pipeline` | The pipeline. It is compared by its JSON, so it may be rebuilt on every render; a value JSON drops or flattens in a stage's `data`, such as a function or a `Map`, is not seen changing. |
| `run` | One run of the pipeline, drawn over it (below). It may change every frame. |
| `look`, `options` | How it is drawn, and that look's options. Default look `nodeGraph`. |
| `width`, `height` | The canvas size. |
| `minScale` | The smallest scale the chart opens at; a chart too big to fit whole at it opens at its start, the rest a pan away. Default `EFFECT_MIN_SCALE`, 0.5, which sets the shipped looks' titles at 6px. |
| `background` | What the canvas paints behind the chart. Unset, it is transparent; the shipped looks are drawn for a dark ground. |
| `selected`, `onSelect` | As on `DiagramView`, for stage ids. A pick of anything that is not a stage, such as a group box, is reported as `null`, and the canvas keeps its own highlight on it. |
| `onProblems` | Hears what `checkPipeline` found, on mount and each time the pipeline's content changes, whether or not the list differs. |
| `className` | A class for the canvas element. |

Keep `look` and `options` steady between renders: a new object for either lays
the chart out again and opens it fitted afresh, as a pipeline whose content
changes does. Ports that
carry a value type are drawn, colored by type. As with `DiagramView`, call
`registerCanvasFont('sans-serif')` once or labels render blank.

#### Runs

A run is what one pass through the pipeline did, kept beside the pipeline
rather than in it, keyed by stage id:

```ts
const run: EffectRun = {
  stages: {
    src: { cost: 0.3, values: { out: '1920×1080' } },
    q: { taken: 'yes' },                    // a decision's chosen output
    blur: { cost: 4.2, values: { out: '6.0 px' } },
  },
};
```

A stage the run has no entry for is one it never reached. The chart fades such
a stage, its rows and its wires, and a decision's wires to the outputs it did
not take, every one of them when `taken` names none; where a look draws a
decision as something else, as `rack` draws a skip as an arc, the look's
`exits` say which edges stand for which exit. It writes each stage's `cost`, in milliseconds, above its top-right
corner; and writes each output's value into the row a look keeps for it when
its `showValues` option is on, with a dash for an output the run says nothing
about. A `switch` symbol is drawn thrown to its first exit, and a run whose
`taken` is the second throws it there. `EffectChart` fades the port dots of a
stage the run never reached as well; `paintRun` alone cannot, since the port
layer draws them outside the scene. A decision a look does not draw has nowhere
to show its cost.

A run never lays the chart out again or refits it: `paintRun(pipeline, specs,
run)` edits the specs the look already built, data only, and `DiagramView`
writes just the fields that changed. So `showValues` keeps its rows from the
first draw, wide enough for a value of about nine characters, and a longer one
runs past the box's edge rather than resizing it.

A run can also carry a picture per output, `previews: { [port]: ImageBitmap }`
on a stage's entry. With a look's `showPreviews` on, each output gets a slot
`previewSize` big (default `PREVIEW_SIZE`, a 48-unit square; or `{ width,
height }`) under its value row, kept from the first draw like the value rows,
drawn as an empty frame until a run fills it. The preview is stretched to the
slot. It is an `ImageBitmap`, not a canvas, because a bitmap's pixels cannot
change: a run that hands back the same bitmap edits nothing and uploads
nothing, and new pixels are a new bitmap. A canvas you draw into becomes one
with `transferToImageBitmap()` (`OffscreenCanvas`) or `createImageBitmap()`.
`EffectChart` frees the texture of a bitmap the next run no longer shows, and
of every one it shows when it unmounts; closing a bitmap is still yours to do.
Under `paintRun` alone the slot becomes an image node whose `src` is
`bitmapSrc(bitmap)` from `@weasel-js/core`, and releasing the replaced
textures is the caller's: `releaseImageSource(old)` from
`@weasel-js/core/renderer`.

`checkPipeline(pipeline)` returns the problems without drawing anything, each
`{ kind, message, stage?, port?, wire?, group? }`, where `wire` is an index into
`pipeline.wires`. The shipped looks draw a pipeline with problems as far as
they can:

| `kind` | When | On the chart |
| --- | --- | --- |
| `missing-stage`, `missing-port` | A wire names a stage or port that does not exist. | The wire is left out. |
| `wrong-direction` | A wire starts at an input or ends at an output. | The wire is drawn in the warning color. |
| `type-mismatch` | A wire joins ports of different types. | The wire is drawn in the warning color. |
| `duplicate-stage` | Two stages share an id. | The first is drawn. |
| `duplicate-port` | Two ports on one stage share an id. | Both are listed; wires attach to the first. |
| `duplicate-group` | A group's id repeats an earlier group's, or is a stage's. | Only the first group with the id is drawn, and a group with a stage's id is not. |
| `missing-member` | A group names something that is neither a stage nor a group. | The name is ignored. |
| `bad-split` | A `split` names an input the stage lacks, has no cuts, has cuts out of order or one that is not a finite number, or does not have one more output than cuts. | A decision that would draw as a bar draws as a diamond. |

#### Looks

A look is how a pipeline is drawn: a function from the pipeline and its
options to `{ data, scene, color }`, which are `diagramScene`'s two arguments
and a `color(type)` for the ports. `EFFECT_LOOKS` holds `nodeGraph`, `rack`, `lanes` and `compact`.

| Look | Draws | Options |
| --- | --- | --- |
| `nodeGraph` (default) | Every port a named row on its stage, a wire from port to port, flowing left to right. | `router` (default `'bezier'`), `nodeGap`, `rankGap`, `colors`, `showParams`, `showValues`, `showPreviews`, `previewSize`, `branch` |
| `rack` | The main signal on one straight line, and everything else hung beside the stage on the line it is nearest to, whichever way the wire runs. | `chain`, `side`, `nodeGap`, `rankGap`, `colors`, `showParams`, `showValues`, `showPreviews`, `previewSize`, `branch`, `collapseSkips` |
| `lanes` | A horizontal lane per value type, and each stage standing across the lanes of the types it reads and writes, as tall as they are, its ports in their own lanes. | `lanes`, `laneHeight`, `rankGap`, `router`, `colors`, `showParams`, `showValues`, `showPreviews`, `previewSize`, `branch`, `measure` |
| `compact` | Each stage one line, its title alone, no ports drawn, and one line between two stages however many wires join them. For a pipeline too big to read as a node graph. | `router`, `nodeGap`, `rankGap`, `colors`, `branch` |

`colors` maps a value type to a color, over the palette; `showParams` (default
true) shows the `params` of ordinary stages, sources and sinks; `showValues`
(default false) keeps a row per output on those stages for a run's values, and
`showPreviews` (default false) a slot per output for its previews. `rack` runs
along `chain`, a list of stage ids that defaults to the longest path over data
wires (`mainChain(pipeline)` returns it); `side` is `'below'` (default) or
`'above'`.

`lanes` puts the lanes top down in the order their types first appear on the
pipeline's ports, after any it is given in `lanes`. A stage stands
`LANE_INSET` inside the first and last lane it touches and covers every lane
between; its inputs sit on its left edge and its outputs on its right, each in
its own type's lane. Stages stand in columns, each right of every stage that
feeds it, and a stage moves a column further right rather than share one with
a stage holding any of its lanes. A lane is `laneHeight` (default 48) tall, or
taller until each stage fits the lanes it spans, params and value rows
included; a source or sink stretched taller than it measured is widened by as
much, so its round ends leave its rows the room they had. A decision keeps its symbol's own size, centered across its lanes,
and brings its control inputs in from the bottom when their lanes are below
the rest of its ports. The lanes are nodes too, `laneId(type)`, drawn behind
the stages, and only stages can be picked: a click on a lane or a group box
selects nothing. A wire that would cross a stage in its lane runs along a lane
edge clear of every stage it passes, changing height only between columns, each
wire in a shared corridor on a track of its own; its label sits as near the
middle as it can without covering a stage. A decision's title and cut values
stay inside its lanes and column. Text is measured to cut the
lanes before `diagramScene` lays anything out, so pass `measure` to the look,
not to `diagramScene`: the look hands it on in `scene`.

`compact` shows no params and keeps no value rows or preview slots: one line
has no room for them, so a run fades and costs its stages but writes no values
and draws no previews. Its ports
carry no type, which is what keeps the port layer from drawing them. A
decision draws as a `'hexagon'` by default, the one symbol a single row holds;
another `branch` draws at that symbol's own size. Wires between two stages
draw as one line, in the color of a data wire among them, dashed only when
every one is a control wire, and in the warning color when any was flagged;
a decision keeps one line per exit, labeled, so a run can fade the exits it
did not take.

With `collapseSkips` (default true), `rack` draws a decision as an arc over the
stages it skips, not as a symbol, when all of these hold:

- it is on the line, but not first on it;
- it has one input and two outputs, with one wire into it and two out;
- the wire in comes from the stage before it on the line;
- one wire out goes to the next stage on the line, and the other lands on a
  stage further along;
- none of the stage before it, the stage it goes on to and the stage its skip
  lands on is a decision. A source or a sink is fine.

A decision stage draws as a branch symbol, chosen by `branch`:

| `branch` | Symbol |
| --- | --- |
| `'auto'` (default) | `'bar'` for a decision with a sound `split`, else `'diamond'`. |
| `'diamond'` | A flowchart diamond titled with the stage. |
| `'bar'` | A tall bar in bands of equal height, the cut values as labels at the ticks. |
| `'demux'` | A trapezoid with the exits spread down its right side. |
| `'switch'` | A lever thrown between two contacts. |
| `'hexagon'` | The stage's title inside a flat hexagon, on one line. |
| `'step'` | A staircase rising a step at each cut, the cut values under the risers. |
| `'comparator'` | A triangle pointing right, its two exits leaving by its slanted edges. With a sound one-cut `split` the high band leaves by the upper edge and the cut is written inside; otherwise the first exit leaves by the upper edge, and two inputs on its flat side are marked `+` and `−`. |
| `'crossover'` | One filter curve per band, lowest at the bottom, overlapping at each cut. |
| `'fork'` | A bare dot every exit leaves from, the conditions left to the labels on its wires. |

`'bar'`, `'step'` and `'crossover'` draw as a diamond for a stage with no `split` or a bad one, and
`'switch'` and `'comparator'` for a stage that does not have exactly two outputs.
`BRANCH_SYMBOLS`, `branchNode` and `symbolNameFor` expose the same lookup. The
signal enters on the left; inputs of a `control` type enter at the top, and so
does the input a `'bar'`, `'step'` or `'crossover'` tests, when the stage has more than one input. A symbol
takes `{ controlSide: 'bottom' }` to bring those inputs in at the bottom instead,
and `rack` passes it with `side: 'below'`, so a control wire comes straight up from
the stage driving it; `lanes` passes it when the control inputs' lanes are below.
The title then moves above the symbol, and a diamond takes control in by its
lower-left edge, keeping its bottom vertex for the second exit. A symbol's lines, dots and ticks are drawn in the `text` color of
`{ style }` (default `stageStyle(stage)`, so a bypassed decision draws dim), and a
`'bar'`'s bands and a `'crossover'`'s curves in `{ tints }`, lowest first; a bypassed
stage's default to its style's `stroke`.

A look is an `EffectLook<TOptions>`. Plain `EffectLook` is a look whose options
are not known, so a list of looks with different options, such as
`[nodeGraph, rack]`, is an `EffectLook[]`; such a look is called with no options.

To write a look, return `{ data, scene, color }`, and `exits` if it draws a
decision as something other than itself; `scene` takes any
`diagramScene` option. The shipped looks are built from these, which are
exported for yours:

| Helper | Gives |
| --- | --- |
| `uniqueStages(pipeline)`, `uniqueGroups(pipeline)` | The stages and the groups with any repeated id dropped, first one kept. `diagramScene` throws on a repeated id, so build nodes and groups from these. |
| `drawableWires(pipeline)` | The wires whose two stages and two ports exist, each as `{ wire, index, type, problem, fromStage, toStage }`: `type` is the value type it carries, and `problem` is true when `checkPipeline` reported it. |
| `typeColors(pipeline, colors)` | The `color(type)` the shipped looks use. |
| `stageStyle(stage)` | A stage's node style: dashed and dim when it is bypassed. |
| `wireStyle(color, control, problem)` | A wire's edge style: dashed for a control wire, and `PROBLEM_COLOR` for a flagged one. |
| `isControl(pipeline, type)` | Whether `types` marks a value type as `control`. |
| `kindOf(stage)` | The stage's `kind`, with any value the shipped looks do not know read as `'stage'`. |
| `portOn(stage, id)` | The stage's port with that id. |
| `stageRows(stage, { showParams, withPorts, showValues, showPreviews, previewSize })` | Body rows for a stage: its title, a row of its ports, per output a value row (`valueRowId(port)`, showing `NO_VALUE`) and a preview slot (`previewRowId(port)`), its params. |
| `wireEdges(pipeline, color)` | An edge per drawable wire, from port to port, named by `exitLabel` and styled by `wireStyle`, each as `{ edge, style }`. |
| `exitLabel(wire)` | What to call one of `drawableWires`' wires: its own label, or for a wire leaving a decision the exit's label or id. |
| `branchNode(stage, pipeline, branch, { controlSide, style, tints })` | The node a decision draws as. |

```tsx
import {
  drawableWires, isControl, stageStyle, typeColors, uniqueGroups, uniqueStages, wireStyle,
  type EffectLook,
} from '@weasel-js/diagram/effect';

const column: EffectLook = (pipeline) => {
  const color = typeColors(pipeline);
  const stages = new Map(uniqueStages(pipeline).map((s) => [s.id, s]));
  const wires = drawableWires(pipeline);
  return {
    data: {
      nodes: [...stages.values()].map((s) => ({ id: s.id, lines: [s.title] })),
      edges: wires.map((d) => ({ from: d.wire.from.stage, to: d.wire.to.stage })),
      groups: uniqueGroups(pipeline),
    },
    scene: {
      layout: 'layered',
      layoutOptions: { direction: 'down' },
      nodeStyle: (n) => stageStyle(stages.get(n.id)!),
      edgeStyle: (e) => {
        const d = wires.find((d) => d.wire.from.stage === e.from && d.wire.to.stage === e.to)!;
        return wireStyle(color(d.type), isControl(pipeline, d.type), d.problem);
      },
    },
    color,
  };
};
```

#### Editing a pipeline

`EffectEditor` is `EffectChart` with the node-graph look made editable: drag a
stage to move it, drag from an output to an input to wire them, press Delete to
remove the selection, drag an end of a selected wire to move it, and drag the
handles along a selected wire to route it (`EffectDoc.routes`, set with
`setWireRoute`). It keeps no
document state. Every edit comes back through `onChange` as the next `EffectDoc` with a
name for an undo entry, and shows once `doc` follows.

```tsx
import { EffectEditor, type EffectEditorApi } from '@weasel-js/diagram/effect';

const api = useRef<EffectEditorApi>(null);

<EffectEditor ref={api} doc={doc} onChange={(next, label) => commit(next, label)} />;

api.current?.addStage({ type: 'gate', title: 'Gate', inputs, outputs });
```

An `EffectStageType` carries the ports and typed params a new stage starts
with. `setParam`, `addWire`, `removeStages` and the rest of the edit model are
plain functions from one `EffectDoc` to the next, and `canWire` asks an
`EffectPipeline` whether two ports may be wired, for driving the edits yourself.

`look` picks the drawing: `'nodeGraph'` (default), `'rack'`, or `'lanes'`, with
that look's `options`. Connecting, reconnecting, and deleting work the same in
all three. Rack and lanes place every stage themselves, so under them a stage
does not move freely. Instead a stage on the main line drags along it: an
insertion bar marks the gap it would land in, drawn in the problem color where
the wiring cannot take it, and releasing it there reports `'Reorder'`. Under
lanes, dragging a lane's label up or down reports `'Reorder lanes'`.

A selected wire's route handles work under every look, and report
`'Edit route'`. Under rack and lanes the route goes in `EffectDoc.lookRoutes`,
by look and then by wire, with the points of the wire's two ports as they were
drawn (`setLookRoute(doc, look, wire, waypoints, ends)`). These looks move
stages on every reorder or added stage, so a route is drawn only while both
ports are still at those points; once one moves, the look routes the wire
again. Reset route, or `setLookRoute` with no waypoints, gives the wire back to
the look. `applyLookRoutes(specs, doc, look, built)` draws the routes that
hold over a look's specs, and `wireEnds(specs, edge)` reads a drawn wire's
port points. A reorder drops the routes of the wires it rewires or removes,
and removing a wire or a stage drops that wire's routes.

```tsx
<EffectEditor doc={doc} onChange={commit} look="rack" />
```

The order is the wiring, so a reorder rewires the pipeline:
`moveInChain(doc, stage, to)` takes the stage's main input and output wires
off, wires its old neighbors to each other, and wires it into gap `to` of
`mainChain`. Side wires, control wires, and params stay with it. It returns
`null` where a new wire would join unlike types. Lane order is
`EffectDoc.laneOrder`, which `setLaneOrder` writes and the editor hands to
`lanes` over `options.lanes`. Rack's `chain` option is not offered here, since a
given chain could disagree with the wiring.

The drag itself is general: `createReorderAction` (in `@weasel-js/diagram`)
carries one item of any drawn sequence along its axis, and the item lands in
the gap nearest its middle. Give it `slots`, the items and gaps that
`sequenceSlots(axis, items)` builds from their boxes, and a `commit` that hears
`{ id, from, to, order }`. `show: 'bar'` (the default) draws the insertion bar;
`show: 'slide'` slides the other items into the places they would take instead,
moving each item's `carries` as pose overrides, which is how `onReorder` shows a
group's members. `reorderContribution` packs the action and its binding to pass
as `ambient`.

## Design notes

Decisions the code cannot explain on its own.

**`dependsOn: 'children'` is deliberately absent from the reverse dependents
index.** Deleting a node deletes everything that names it in `dependsOn`, and a
container must *not* be deleted when a child goes — an emptied group is still a
group. That asymmetry is why a `'children'` container is invalidated by an
ancestor walk instead. Registering it would "fix" the inconsistency and delete
your groups.

**Ports live on the bounds and are cast onto the outline when read.** The
anchor stays normalized against the bounds because that is what survives a
resize; `rayHit` moves it onto the shape. Don't store outline-relative anchors.

**Connect declines in two different places on purpose.** Which presses start a
connect is routing, and lives in the binding's `target`. Which ports a live
connect may land on cannot be routing — the dispatcher never re-reads the
affordance under a moving pointer — so `canConnect` filters the candidate set
instead. Neither is an action body inspecting a hit and bailing.

**A live run does not re-anchor; the one-shot layouts do.** The anchor
translation keeps a single 300-tick jump from moving the diagram off where the
author left it. A live run cannot jump, and re-anchoring per frame would fight
a drag — the anchor is measured from where the nodes were, and a pinned node is
deliberately somewhere else.

**A pose run's frame is the whole picture, not a delta.** An id a producer
omits stops being published, which is what releases a node the moment a gesture
takes it. It is why the layout producers drop a pinned participant's whole
subtree from the frame rather than only the participant.

## License

MIT
