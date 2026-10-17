---
'@weasel-js/diagram': patch
'@weasel-js/core': patch
---

`layered` reads a port where `portsOf` puts it on the node's outline rather than at its anchor, and reads a port with several places at the one nearest where the wire's other end falls among the node's wires on that side, while ordering, rather than at their mean. `GraphNode` carries the node's `outline`.

The compass ports `diagramScene` names under `layered` are marked as layout's: an `EdgeEnd` records the port layout named as `laidOut` (`layoutOwnsPort`), and `LayoutPlan.ports`, which `layeredPlan` now fills, carries them to `routesOf` and `routeWrites`. A later layout names an end again while it names no port or still names that one, so an edit that turns which way an edge runs no longer leaves it leaving by the old face. A live `layered` run or the layout action now names ports on a hand-built scene's edges that name none, as `diagramScene` does.

Breaking: `DiagramLabel`'s `at: { waypoint: k }` is replaced by `at: { near: { x, y } }`, which stations a label where its route passes nearest that point, so a bend added or removed before it leaves it on its stretch. `LayoutPlan.labels`, `LayeredPlan.labels` and `LayeredRoute.labelAt` carry that point instead of a waypoint index.

A group box `diagramScene` makes depends on the labels of the wires with both ends inside it, so a long label no longer spills out of it.

A live eased run eases each route it will write along with its nodes, published as the edge's path on the override channel, rather than drawing long edges through their old bends until it arrives.

Core: `moveSources` and `shapeSources` no longer hand back a node that derives only its path when they reach it through a derived node, so moving or turning a group box that depends on a wire's label does not write the wire's placeholder pose.
