---
'@weasel-js/diagram': patch
---

An edge from a node to itself that names no ports now draws: it leaves by the node's east-facing side, returns by its north-facing one, and passes a point off the corner between them, which `edgeDerivePath` hands the router as a waypoint. It drew nothing before, both ends having picked the same port. `selfLoop` is the rule, `selfLoopStandoff` on `edgeDerivePath`'s options sets how far out the turn is (half the node's shorter side by default), and waypoints the author set are used in place of the rule's point.

The `orthogonal` router no longer doubles back after a waypoint: where splitting the next leg at its midpoint would start back the way the route came, it turns at the waypoint. A route through a waypoint that overshot the next stop changes shape.
