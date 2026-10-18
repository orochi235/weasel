# @weasel-js/diagram-elk

Lays a `@weasel-js/diagram` graph out with [ELK](https://eclipse.dev/elk/), the
Eclipse Layout Kernel, through [elkjs](https://github.com/kieler/elkjs), and
answers with the diagram package's own `LayoutPlan`, so the result is applied
the way `layered` or `tree` is. ELK places ports, edge labels and nested groups
well; use it to lay a diagram out from a `DiagramView`, to lay a generated
diagram out once, or to check one of the diagram package's layouts against it.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/diagram-elk).

```sh
npm install @weasel-js/diagram-elk
```

## Laying a diagram out

On a `DiagramView`, hand `elkPlanner` to `layout()`. The view eases to ELK's
answer the way it eases to `layered`'s and reports the moves, routes and ports
to `onMove`; a drag or another `layout()` call before ELK answers drops the
answer, and an ELK failure goes to the view's `live.onError`.
`elkPlanner`'s options go over the view's `live.layout` options.

```tsx
import { elkPlanner } from '@weasel-js/diagram-elk';

const elk = elkPlanner({ direction: 'right' });
view.current?.layout(elk);
```

`useLiveLayout` takes the same planner as its `algorithm`. To lay a scene out
once, without a view:

```ts
import { applyLayout, buildGraph, routesOf } from '@weasel-js/diagram';
import { elkPlan } from '@weasel-js/diagram-elk';

const graph = buildGraph(source);
const plan = await elkPlan(graph, { direction: 'right', nodeGap: 32 });
applyLayout(scene, plan.moves, { routes: routesOf(graph, plan) });
```

ELK answers asynchronously, so `elkPlan` returns a promise and is not a
`LayoutFn`; `elkPlanner` wraps it as a `LayoutPlanner`, which a live run asks
once and eases to.

What goes in, and how ELK reads it:

| Diagram | ELK |
| --- | --- |
| A participant | A node of its own size. |
| A port an edge names | A fixed port where the diagram draws it, cast onto the node's outline. |
| A group | A compound node, nested the way the groups nest, padded by its `inset`. `minWidth` is its minimum width. |
| An edge to or from a group | One edge to the compound node, not one per member. |
| An edge label's room | An edge label of that size. |
| `direction`, `nodeGap`, `rankGap` | `elk.direction`, `elk.spacing.nodeNode`, `elk.layered.spacing.nodeNodeBetweenLayers`. |
| `order`, `chain`, `chainSide` | Not taken; ELK orders ranks itself. |

What comes back, beyond a `LayoutPlan`'s `moves`, `waypoints` and `labels`:

| Field | What it holds |
| --- | --- |
| `ports` | For each edge, the port it leaves and arrives by: the one it names, or else the declared port nearest where ELK met the node. |
| `routes` | Each routed edge end to end. `waypoints` is the same route without its two ends. |
| `groups` | Each group's box as ELK sized it. Nothing writes these, since the diagram derives a group's box from its members. |
| `unheld` | Pinned nodes ELK put somewhere else. The layout is translated so the first pin stays where it is; ELK cannot be told about the rest. |

An edge the author routed (`GraphEdge.authored`) still shapes the layout but
gets no route back. Anything else ELK takes goes in `layoutOptions`, applied
over the options derived from the rest:

```ts
await elkPlan(graph, { layoutOptions: { 'elk.algorithm': 'mrtree' } });
```

## Size, and where it runs

elkjs 0.12.0's bundled build, `elkjs/lib/elk.bundled.js`, is 1,609,707 bytes:
466,718 gzipped at level 9 and 348,494 under brotli. This package imports it
dynamically on the first layout, so a bundler splits it into a chunk of its own
that loads only when a layout runs. The adapter itself is about 10 KB.

The bundled build runs on the calling thread. To keep a large layout off it,
construct elkjs on its web worker and pass that in:

```ts
import ELK from 'elkjs/lib/elk-api.js';

const elk = new ELK({ workerUrl: new URL('elkjs/lib/elk-worker.min.js', import.meta.url).href });
await elkPlan(graph, { elk });
```

## License

This package is MIT. elkjs, which it depends on, is EPL-2.0 OR
GPL-3.0-or-later.
