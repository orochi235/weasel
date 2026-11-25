# Review saturation for `apps.site.demos.part6`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 48 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Graph generation capacity and injected randomness | 1 | 1 | 0 |
| 2 | Timeline frame cancellation and capture cleanup | 0 | 1 | 1 |
| 3 | Tiled pixel sampling, dither export and viewport wiring | 0 | 1 | 2 |
| 4 | Vertex color transitions, path-effect probes and visual-order helpers | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. The graph generator can loop forever when it cannot draw another distinct edge

[graph.ts](apps/site/demos/forceGraph/graph.ts#L49) · Pass 1 · Low · Source-traced

Call makeGraph with two nodes and two requested edges, or inject a random function that repeatedly chooses the same pair. The generator accepts each unordered pair once and has no capacity check or attempt limit. It never returns once the available pairs are exhausted. The demo's built-in size presets stay below that capacity.

Source and tests were left untouched.
