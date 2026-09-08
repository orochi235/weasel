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

## License

MIT
