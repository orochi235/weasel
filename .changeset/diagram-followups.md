---
'@weasel-js/diagram': patch
---

`onMove`'s `EdgeRoute` now carries `ports`, the ports a layout run named, and an edge is reported
when only its ports change. Store them as the new `DataEdge.routedPorts`, which `edgeIdOf` does not
read, so storing them no longer renames and replaces the edge. Breaking for code that builds an
`EdgeRoute` or assumes a reported route always has new waypoints.

A live run eases routes for every layout, `force` included, and each eased frame draws an edge
through the ports the run will commit, so an edge that changes faces no longer jumps on arrival. An
edge to a group reads the group's box from the same frame.

`layered` holds far more pins: a pin's band slides or deepens to cover it, the gaps toward other
pinned ranks shrink together, a node with no room between two pins moves past one, and a group's
column moves or widens as one so no outsider lands in its box. `LayeredPlan.unheld` is left for
pins no arrangement can reach.

`chain` routes an edge between a chain node and a node hung beside it on a track of its own, orders
the hung row by the ports it connects to, and grows the gap to keep tracks 12 apart, so a fan of
side stages into one `rack` stage never crosses. `rack`'s spread side ports face straight out.

The `lanes` look routes a wire around the stages in its lane, each wire in a shared corridor on its
own track, places labels clear of every stage, and keeps a decision's title and cut values inside
its lanes and column. `EffectChart` picks only stages, so clicking a lane or group box no longer
leaves it highlighted.

A perimeter port can carry a `label` (`PortSpec.label`, or `portLabels` by port id on a `BodySpec` or
`DataNode`), drawn outside the node beside its wire. Layout lays each node out at its bounds grown by
the room its labels take (`DiagramNode.margin`, `GraphNode.margin`), and a group's box takes it in.
A port's alternative `sites` may carry their own `normal` (`PortSite`).

`diagramLayoutOf(specs)` reads where a `diagramScene` build's layout put each unpinned node, and the
routes and ports it wrote, in `onMove`'s shapes, so a host can keep a diagram still across edits.

Under `layered`, an edge between two nodes that pins leave level along the rank axis runs straight
between their facing sides, or around past both when a node sits between them, instead of looping
round.
