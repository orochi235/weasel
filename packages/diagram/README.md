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
[API reference](https://orochi235.github.io/weasel/api/).

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

### Laying it out

`layered`, `tree` and `force` are plain functions of the graph. Each hands back
the new top-left for every node that **moves** — a node already standing where
the layout wants it is absent, so re-running a layout on an unchanged diagram
writes nothing at all.

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

`force` is the exception to the second half of that: it is an iterative
relaxation seeded from the current positions, so re-running it keeps relaxing.

`chain` stands one run of nodes on a straight line and hangs everything else
beside the chain node it is nearest to, the way a rack of effects has its side
inputs under it. The `chain` layout option lists the ids on the line, in order;
unset, it is the longest path through the graph. `chainSide` is `'after'`
(default) or `'before'`: which side of the line the rest hangs on. Each chain
node owns a column as wide as the widest thing hung on it, so neighbors never
share space. Groups are ignored.

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
label row each. An edge can name `fromPort`/`toPort`, its own `router`,
`waypoints` and `labelPlacement`.

`outline` is `'rect'`, `'diamond'`, `'stadium'`, `'parallelogram'`,
`'trapezoid'` (a demultiplexer: tall at the right, short at the left), or a
`Path`. A `Path` is in world coordinates, so it does not follow its node when
layout moves it.

`marks` draws more over a box than its rows. A mark with `d` is SVG path data
in a unit square, stretched over the node's box; it takes `fill`, `stroke`,
`strokeWidth`, `dash` and `opacity`. A mark with `text` is pinned to a point on
the box: `at` is that point as `{ u, v }` fractions of the box, `self` is which
point of the text sits on it (default `at`), and `offset` nudges it in pixels.
Marks move with their node:

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

`groups` draws a box around some nodes, with an optional `label` inside it:

```tsx
diagramScene({ nodes, edges, groups: [{ id: 'ingest', members: ['fetch', 'decode'], label: 'ingest' }] });
```

`layered` and `tree` keep a group's members together. Each group gets a column
on the cross axis that nothing else enters, in every rank from its first
member's to its last, and rank gaps widen where a box needs the room. The box
is an ordinary scene node that depends on its members and derives its pose from
theirs (`groupDerivePose`), so dragging a member carries the box along. An edge
whose `from` or `to` names a group meets the box, and ranks against the
group's first stage. Groups are flat, and `force` ignores them. A scene built
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
moved; `onConnect` makes ports grabbable and hears the edge a connect
describes. Store a move as the node's `at`, with `pinned: true` unless the
scene uses `layout: 'none'`, or the next `diagramScene` lays it out again.
`view.current.layout('layered')` re-runs a layout animated from where the
nodes stand; `'force'` relaxes live.

Labels paint only in a registered font family, and the default is
sans-serif, so call `registerCanvasFont('sans-serif')` once or they render
blank. `minScale` stops the initial fit from shrinking a wide diagram past
readable; the rest is a pan away.

### Effect charts

`@weasel-js/diagram/effect` draws an effects pipeline: the stages a signal
passes through, what each reads and writes, and where a decision sends it.

```tsx
import { EffectChart, rack } from '@weasel-js/diagram/effect';

<EffectChart pipeline={pipeline} look={rack} width={900} height={420} />
```

A pipeline is plain data and says nothing about how it is drawn:

| Field | Meaning |
| --- | --- |
| `stages` | `{ id, title, kind?, inputs?, outputs?, params?, split?, bypassed? }`. `kind` is `'stage'` (default), `'decision'`, `'source'` or `'sink'`; any other value draws as `'stage'`. `params` are `{ label, value }` pairs shown on the box. `bypassed` draws the stage dashed and dim. |
| ports | `{ id, label?, type }`, in a stage's `inputs` and `outputs`. `type` names a value type; a wire joins ports of one type. |
| `wires` | `{ from: { stage, port }, to: { stage, port }, label? }`, from an output to an input. |
| `groups` | `{ id, label?, members }`: a box around stages and other groups. |
| `types` | `{ [type]: { control?: boolean } }`. A `control` type carries a condition or a modulation rather than the signal, and its wires draw dashed. |
| `split` | On a decision that compares a number: `{ input, at }`, the input it compares and the cut points in ascending order. N cuts need N + 1 outputs, lowest band first. |

`EffectChart` takes the `pipeline`, a `look`, the look's `options`, a `width`
and `height`, and `selected` / `onSelect` as `DiagramView` does, for stage ids.
`onProblems` hears what `checkPipeline` found, each time the pipeline's
problems change. Keep `options` steady between renders, or the chart lays out
again on each one. Ports that carry a value type are drawn, colored by type.
As with `DiagramView`, call `registerCanvasFont('sans-serif')` once or labels
render blank.

`checkPipeline(pipeline)` returns the problems without drawing anything, each
`{ kind, message, stage?, port?, wire?, group? }`:

| `kind` | When |
| --- | --- |
| `missing-stage`, `missing-port` | A wire names a stage or port that does not exist. |
| `wrong-direction` | A wire starts at an input or ends at an output. |
| `type-mismatch` | A wire joins ports of different types. |
| `duplicate-stage`, `duplicate-port` | Two stages share an id, or two ports on one stage do. |
| `missing-member` | A group names something that is neither a stage nor a group. |
| `bad-split` | A `split` names an input the stage lacks, has no cuts or unordered ones, or does not have one more output than cuts. |

The looks draw a flawed wire red.

#### Looks

A look is how a pipeline is drawn: a function from the pipeline and its
options to `{ data, scene, color }`, which are `diagramScene`'s two arguments
and a `color(type)` for the ports. `EFFECT_LOOKS` holds the two that ship.

| Look | Draws | Options |
| --- | --- | --- |
| `nodeGraph` (default) | Every port a named row on its stage, a wire from port to port, flowing left to right. | `router` (default `'bezier'`), `nodeGap`, `rankGap`, `colors`, `showParams`, `branch` |
| `rack` | The main signal on one straight line, and whatever feeds a stage from the side hung beside it. | `chain`, `side`, `nodeGap`, `rankGap`, `colors`, `showParams`, `branch`, `collapseSkips` |

`colors` maps a value type to a color, over the palette; `showParams` (default
true) shows each stage's `params`. `rack` runs along `chain`, a list of stage
ids that defaults to the longest path over data wires (`mainChain(pipeline)`
returns it); `side` is `'below'` (default) or `'above'`. With `collapseSkips`
(default true), a decision that only chooses between going on and skipping
ahead draws as an arc over what it skips, provided the stage before it, the
stage it goes on to and the stage its skip lands on are all ordinary stages;
otherwise it draws as its branch symbol.

A decision stage draws as a branch symbol, chosen by `branch`:

| `branch` | Symbol | Draws as `diamond` instead when |
| --- | --- | --- |
| `'auto'` (default) | `bar` for a decision with a sound `split`, else `diamond` | |
| `'diamond'` | A flowchart diamond titled with the stage | |
| `'bar'` | A tall bar in bands of equal height, the cut values as labels at the ticks | the stage has no `split`, or `checkPipeline` reports it as `bad-split` |
| `'demux'` | A trapezoid with the exits spread down its right side | |
| `'switch'` | A lever thrown between two contacts | the stage does not have exactly two outputs |

`BRANCH_SYMBOLS`, `branchNode` and `symbolNameFor` expose the same lookup. The
signal enters on the left; inputs of a `control` type enter at the top.

To write a look, return `{ data, scene, color }`. `typeColors(pipeline,
colors)` gives the `color` the shipped looks use, and `scene` takes any
`diagramScene` option:

```tsx
const column: EffectLook = (pipeline) => ({
  data: {
    nodes: pipeline.stages.map((s) => ({ id: s.id, lines: [s.title] })),
    edges: pipeline.wires.map((w) => ({ from: w.from.stage, to: w.to.stage })),
  },
  scene: { layout: 'layered', layoutOptions: { direction: 'down' } },
  color: typeColors(pipeline),
});
```

Try looks and options on the sample pipelines in the workshop's "diagram/EffectChart lab"
story (`src/effect/lab/EffectLab.stories.tsx`; it is not part of the published
package).

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
