# Diagram plugin design

**What this is:** the design for `@weasel-js/diagram`, a node-link diagramming plugin for
code-flow diagrams, pipelines, simple visual programming, and traditional flowcharts — plus
the two changes to `core` it depends on.

**Who it's for:** whoever implements it. Assumes weasel's scene graph, contributions,
affordances, and op/history model; assumes no memory of the conversation that produced this.

**What it answers:** where diagrams live relative to the scene graph, and what has to exist in
the engine before any of it can be built.

## Scope

In: a graph model, ports, edges with routing, seeded layout, and the tools to author all of it
by hand.

Out: scales, axes, ticks, marks, legends — the data-visualization sense of "chart", which
keeps that name for its own package later. The only thing the two share is the data-join
already shipped in `@weasel-js/d3`.

## Vocabulary

`DiagramNode` is a trait that makes any scene node a participant in a diagram — a flowchart
step, a pipeline stage, a visual-programming operator, or a block of code. `DiagramEdge` is a
connection between two participants. `Port` is an attachment point on a participant. `Graph` is
the adjacency index derived from the scene for traversal and layout.

Diagram participants and edges are both **scene nodes**. When this document says "scene node"
it means weasel's `Node<TData, TLayer, TPose>`; the `Diagram` prefix marks the plugin's own
types, which sit next to scene nodes in consumer code and would otherwise be ambiguous. Layout
internals use the ordinary graph words.

## The scene is the document

A diagram participant is any scene node, and its pose is **authored** — the author drags it
and it stays there. A `DiagramEdge` is a leaf scene node whose geometry is **derived** from the
poses of the two nodes it names. There is no parallel graph document kept in sync with the scene;
`Graph` is an index over the scene, not a second source of truth.

Making edges scene nodes rather than a plugin-owned render layer is the load-bearing choice.
It buys selection, hit-testing, hover, styling, z-order, SVG export, undo, and copy/paste
without implementing any of them. The cost is that an edge costs what a node costs — correct
for diagrams of tens to hundreds of edges, wrong for a 10k-edge force graph. The existing
`force-graph` demo stays on its render layer; it is not a migration target.

## Core change 1: derived geometry

The engine cannot express a node whose geometry depends on another node.
`NodeShapeEntry.paint(node, pose, ctx)` receives no scene handle
(`packages/core/src/canvas/NodeShape.ts:96`), so an edge cannot be written as a painter.

Add to `Node`:

```ts
dependsOn?: NodeId[]
derive?: (node, deps: PoseLookup) => Path   // registered by key in SceneRegistry
```

A resolve pass runs once per frame ahead of paint. `nodeMemo`'s key extends to include the
resolved dependency poses, so a cached derived path invalidates when an endpoint moves.

This follows `ContainerNode.clipFromPose` (`core/src/core/scene/types.ts:103`), already a
function-field on a node, re-evaluated each render, serialized by `SceneRegistry` key
(`types.ts:211`). The difference is the dependency list.

It belongs in `core`, not in the plugin, because it is not an edge feature. Edge labels,
leader lines, callouts, dimension annotations, brackets, and a frame that hugs its contents are
all the same primitive.

It does **not** fix the group-bounds defect — a container's bounds are a snapshot taken at
creation and never re-derived when its children move
(`core/src/interactions/actions/defaults/group.ts:68`). Stale bounds are a derived *pose*; this
is derived *path*. Adjacent seams, not the same one, and derived pose reaches much further,
because pose feeds bounds, which feeds hit-testing, selection chrome, snapping and layout. It is
arc 1b below.

So derived path has no consumer outside this plugin, and the case for putting it in `core` rather
than in the plugin is thinner than "it also fixes an existing defect" made it. It still stands on
the list above.

**New scene rule: deleting a node invalidates its dependents.** Deleting a `DiagramNode`
removes its edges in the same undo entry. The scene has never needed cascade integrity before;
this is the sharpest edge in the design.

## Core change 2: stroke markers

Arrowheads do not exist anywhere in the repo. They belong in stroke style, not in this plugin.

SVG classes `marker-start` / `marker-mid` / `marker-end` as stroke presentation attributes,
siblings of `stroke-dasharray` and `stroke-linecap`. `packages/svg/src/parse.ts:541` already
enumerates exactly that group and handles every member of it except markers, and
`packages/svg/src/gradients.ts:37` records `<marker>` as deliberately unmodeled. Putting
arrowheads in `diagram` would force `@weasel-js/svg` to depend on `diagram` — the wrong
direction — or make diagram edges lose their arrowheads on export.

The mechanism is core: `markerStart` / `markerEnd` resolving by key, plus a registry mapping a
key to marker geometry and a placement rule. The vocabulary — open arrow, closed arrow,
diamond, circle — is registered entries and can ship from anywhere.

The non-obvious part is also core-shaped: **a filled marker requires the stroke to stop short
of the tip**, or the line spikes through it. That is stroke geometry, adjacent to the stroke
ribbon cache, not diagram logic. `flattenCubicWithArcLen` already provides the arc-length
placement markers need.

## Any scene node can be a diagram node

`DiagramNode` is **a trait attached to an existing scene node, not a node type the plugin
mints**. A text block, an image, a path, a group, or a plain rect all become diagram
participants by carrying the trait; nothing has to be authored through the plugin to take
part. This follows how the kit already layers behavior — `registerNodeShape`, `NodeRouting`,
`NodeProperties` are all traits keyed off node data rather than a node-kind hierarchy.

```ts
DiagramNode = {
  ports?: PortSpec[]      // defaults to perimeter anchors on the node's bounds
  pinned?: boolean        // layout must not move it
}
```

The default port set works for anything, because every node has bounds: perimeter anchors are
computed from the pose descriptor's `getBounds`. A node needs to say nothing to be connectable.

### The body builder is optional

For nodes that should *look* like a flowchart box or a visual-programming operator, the plugin
ships a builder that composes ordinary scene nodes:

```
outline: 'rect' | 'diamond' | 'stadium' | 'parallelogram' | Path
body:    Row[]           // label | field | portRow | slot
```

A flowchart decision is `outline: 'diamond', body: [label]`, ports on the perimeter. A pipeline
stage is `outline: 'rect', body: [title, ...portRows]`, ports on the row anchors. Code-flow
diagrams largely skip the builder — their nodes are code or text blocks that already exist.

**Sizing applies only to built bodies: the body measures a floor, the author sets the rest.**
The body measures to `{ minW, minH }` and `pose.w = max(authored.w, minW)`. Adding a port row
can grow a node; it never shrinks back on its own. Because the pose stays authored data,
resize, align, distribute, guides, snapping, and undo need no special case. A node that did not
come from the builder just has whatever size it already had.

The body measure composes `features/text/fitTextPose.ts` and `verticalAlign.ts` rather than
reimplementing text measurement.

## DiagramEdge

A leaf scene node with `dependsOn: [from, to]` whose `derive` runs a **router**. Routers
register by key — the idiom `registerNodeShape` and `NodeRouting` already use — so consumers
add their own. Ships: `straight`, `orthogonal`, `bezier`. Arrowheads come from stroke markers,
not from the router.

**Author-dragged waypoints are data on the edge and the router routes through them.** Manual
control never authors the path; it authors constraints on the path. This is what keeps derived
geometry and hand-tuning compatible.

**Edge labels** — `true` / `false` branches, exception paths — are scene nodes with
`dependsOn: [edge]`, positioned from a parameter along the routed path. They are a third
consumer of the same derived-geometry primitive, after edges and re-derived group bounds.

## Ports are affordances

Port positions derive from the node — a body row's anchor, or a point on the outline
perimeter. The plugin contributes an affordance layer supplying `port` regions; the kit's
"visible chrome is always hittable" rule then supplies hover and hit-testing.

Connect is an ordinary binding gated on `affordance.kind === 'port'`, dispatching a
`diagram.connect` ongoing action. Preview during the drag is an ephemeral edge; commit is one
op batch. Typed ports carry a `canConnect(from, to)` predicate, and **invalid targets are
declined in the binding spec, not in the action body**.

## Layout is seeded, deterministic, and pinnable

Layout is an action producing one undoable batch of pose ops. Current poses are an input, not
a starting guess to discard:

```ts
layout(graph, currentPoses, opts) => Map<NodeId, Pose>
```

Ships `layered` (DAG pipelines), `tree`, and `force` — force reusing the existing
`useSimulation` seeded from current positions rather than adding a second integrator.

Three rules keep re-layout non-destructive:

- Deterministic tiebreaks. No RNG anywhere in the layout path.
- Within-rank ordering seeded from the existing cross-axis order, rather than pure
  crossing-minimization.
- A `pin` set layout must not move.

**Running layout twice on an unchanged graph produces zero ops.** That is a test.

## Packaging

`packages/diagram`, peer-depending on `@weasel-js/core` as `hud`, `d3`, and `ui` do. It ships
as a `Contribution` bundle composed with `mergeContributions`.

It is **not** a `useDiagramPack` in `packages/den`. `docs/TODO.md:1203` still promises that,
but `packages/den` is a README-only stub and its `{ registry, alwaysOn, keybindings }` pack
shape was superseded by core's contributions — `alwaysOn` became `ambient`, and the binary
registry/ambient split became a four-condition eligibility set. That TODO entry should be
retired when this lands.

## Testing

- **A guard test that fails on a stale memo.** Write the naive derive pass, watch it return the
  previous path after an endpoint moves, then fix it.
- **Cascade delete is one undo entry** — node and edges leave and return together.
- **A visual baseline on node body measurement.** Per the jsdom trap, a body that measures to
  zero renders as an empty page with every test green.
- **A visual baseline on a filled marker** — the stroke inset is invisible to a geometry test
  and obvious in a render.
- **Layout idempotence** — re-running on an unchanged graph emits no ops.

## Arcs

1. **Derived path in core.** `dependsOn` + `derive` + memo invalidation + cascade delete. Lands
   and goes green alone; it touches the hot render path and the serialization format, and nothing
   diagram-shaped should be built on an unproven seam.

   **1b. Derived pose.** The same dependency machinery driving a node's pose rather than its
   path, which is what the group-bounds defect at
   `core/src/interactions/actions/defaults/group.ts:68` needs. Behind arc 1 because pose feeds
   bounds, hit-testing, selection chrome and layout, so it reaches much further into the frame
   than painting does.
2. **Stroke markers in core**, including the stroke inset and SVG `<marker>` round-trip in
   `@weasel-js/svg`. Independent of arc 1; the two can run in parallel.
3. **`packages/diagram` skeleton.** The `DiagramNode` trait and default perimeter ports on
   arbitrary scene nodes. The body builder — outline, measured rows, sizing floor — comes with
   it but is not what makes a node connectable.
4. **Edges and routing.**
5. **Ports, the connect gesture, and typed connection validity.**
6. **Layout.**
7. **A demo per `docs/CLAUDE.md`'s demo conventions** — terse, single-purpose, on the platform
   systems rather than around them.

## Open question

**Does `Graph` need incremental maintenance,** or is rebuilding the adjacency index per layout
invocation sufficient? Rebuild until measurement says otherwise.
