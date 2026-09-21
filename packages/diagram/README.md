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

## Design notes

Five decisions the code cannot explain on its own.

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
