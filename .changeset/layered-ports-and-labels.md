---
'@weasel-js/diagram': patch
---

`layered` reads ports and leaves labels room.

- **Ports.** The layout graph carries each node's ports (`GraphNode.ports`) and the ports an edge
  names (`GraphEdge.fromPort`, `toPort`); `buildGraph` and `diagramScene` fill them in. Ordering
  reads each wire at the port it joins, so wires into one node arrive in the order of its ports,
  and placement lines up the two ports a wire joins rather than the two centers.
- **Port places.** A `PortSpec` may list other places it can sit in `sites`. An edge meeting the
  port takes whichever place faces its next point; `portSitesOf` resolves them all. The decision
  diamond's second exit may now leave by its top vertex as well as its bottom.
- **Label room.** Under `order: 'barycenter'`, an edge whose `GraphEdge.label` gives its label's
  size gets a rank of its own between its ends, with room beside its wire. `layeredPlan` reports
  where (`labels`), and `diagramScene` sets each label there unless its edge sets
  `labelPlacement`. `DiagramLabel.at` takes `{ waypoint }`, a place between two of the edge's
  waypoints.

Behavior changes: a diagram with labeled edges laid out by `diagramScene` is taller (or wider)
than before, and lands in a different place. An edge end with no named port now aims at the
edge's first or last waypoint, not the other node, when it has waypoints. A smooth (`bezier`)
route passes two waypoints level on one axis along that axis.
