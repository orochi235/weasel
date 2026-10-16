---
"@weasel-js/diagram": patch
---

`layered` lays diagrams out differently, so a diagram laid out before this lands somewhere else
after it. Ranks keep edges as short as they can (network simplex, exported as `ranksByLength`),
so a node with no inputs sits beside what it feeds instead of in the first rank, and nodes are
lined up with their neighbors across ranks (Brandes–Köpf) instead of packed and centered. Under
`order: 'barycenter'`, which `diagramScene` uses, an edge spanning ranks stands in each rank it
crosses, so ordering counts its crossings and placement leaves it room; ordering also swaps
neighbors to clear crossings and keeps the best order it finds. An edge closing a cycle is turned
around for layout, so it gets a route too.

New `layeredPlan(graph, opts)` returns the moves with each node's rank and each spanning edge's
waypoints; `diagramScene` draws those edges through them. `LayeredRouteInput` changes shape: it
takes `ranks` and `waypoints` from a plan in place of `graph`, `boxes` and `clearance`.
`GraphEdge` gains an optional `origin`, the edge as drawn, on edges `expandGroupEdges` made for
an edge to or from a group.
