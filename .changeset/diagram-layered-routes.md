---
'@weasel-js/diagram': patch
---

`diagramScene` routes a `layered` diagram's edges. An edge running down the ranks leaves its source by the face toward the next rank and arrives at its target's face toward the last, where it used to take whichever side faced the other end, and an edge that skips ranks gets waypoints through the gaps in each rank it crosses, so it goes around the nodes and group boxes in its way. An author's `fromPort`, `toPort` and `waypoints` win; an edge running back up the ranks, and every other layout, keep the facing rule. `layeredRoutes` is the pass on its own.

The `bezier` router passes a waypoint without a corner; it used to draw each leg between two waypoints as a straight line.

A group's box fits its label. `DiagramGroup` gains `minWidth`, which `diagramScene` sets from the label, `groupDerivePose` widens the box to evenly, and `layered` and `tree` leave room for in a layout running down or up; `GraphGroup` carries it too, and `boxAround` is the box rule on its own.

Breaking: a label's `offset` is the gap between the route and the label's near side, where it was the distance to the label's center, so a label beside a vertical edge no longer straddles it.
