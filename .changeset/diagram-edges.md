---
'@weasel-js/diagram': patch
---

Edges. A `DiagramEdge` is an ordinary leaf scene node with
`dependsOn: [from, to]` and a `derivePath` that runs a **router**, so it
re-routes whenever either end moves and there is no parallel graph to keep in
sync. Being a scene node is what buys it selection, hit-testing, hover,
styling, z-order, SVG export, undo and copy/paste for free.

Three routers ship: `straight`, `orthogonal` (leaves along each port's facing
before turning) and `bezier` (leaves along one normal and arrives against the
other, which is what makes an edge read as plugged into its port). Consumers
register their own in the same shape. Author-dragged `waypoints` are data on
the edge and the router routes *through* them — manual control authors
constraints on the path, never the path itself, so a hand-tuned edge still
follows a moved endpoint.

An end that names no port resolves to the one **facing** the other end rather
than the nearest: on a wide node the far-side port is often closer in a
straight line, and an edge leaving through its own node reads as a bug however
short it is.

Ports are now cast from the node's bounds onto its outline. The bounds anchor
is what makes a port survive a resize, but it is not where the ink is — a
parallelogram's west anchor sits in the gap beside its leaning edge, and an
edge ending there ends in empty space. `rayHit` casts the anchor back onto the
flattened outline along the ray from the node's center, which is the direction
an edge leaves anyway.

`withDiagramRegistry` merges the edge router under a consumer's registry so an
edge round-trips through `toJSON` without them wiring the key.

Edge labels are not built yet: a label positioned along the route needs the
routed path, which a derivation is not handed.
