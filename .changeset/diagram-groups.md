---
"@weasel-js/diagram": patch
---

`diagramScene` takes `groups`: each draws a box around its member nodes, with an optional label inside it, and `layered` and `tree` keep a group's members together. Each group gets a column on the cross axis that nothing else enters, in every rank from its first member's to its last, and rank gaps widen where a box needs the room. The box is a scene node that derives its pose from its members, so dragging a member carries it along. An edge naming a group meets the box, and ranks against the group's first stage.

Underneath, `Graph` carries `groups` and each `GraphNode` its `group`, and `buildGraph` reads a group from a node whose trait carries `group`, its `dependsOn` naming the members, so `applyLayout`, `useLiveLayout` and `DiagramView` keep groups together too. `packClusters`, `rankGaps` and `expandGroupEdges` are exported for a custom `LayoutFn`. `groupDerivePose` and `anchorDerivePose` (a node held at a point on another's bounds, as a group's label is) are registered by `withDiagramRegistry`. `fitDiagram` frames group boxes as well as node boxes. Groups are flat, and `force` ignores them.
