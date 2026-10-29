---
'@weasel-js/core': patch
'@weasel-js/guides': patch
---

Grid lines and ruler guides now line up a moved shape's drawn box, stroke included, instead of its pose origin, so **stroked shapes land half a stroke width differently against grid lines and guides**: a rect with a 10-wide stroke now puts its stroke's outer edge on the line, where it used to put the rect's own edge, 5 further in. The grid also lands a box's center or far edge when that is nearer a line than its near edge, and a multi-node move snaps the union box rather than each node's origin. On a turned container's lattice the grid still snaps the pose origin. Drawing a new shape and the pen are unchanged; they snap the pointer.

On a resize that turns or skews the box, equal spacing now snaps the sides of the box's axis-aligned extent the drag moves, solving along the handle's own axis; it offered nothing before. Alignment and spacing marks on such a resize span the box where it lands.

Breaking for a custom `SnapSource`: `SnapCollect.edges` and the `SnapEdge` and `SnapEdges` types are removed. `SnapCollect.sides` lists the sides of the box a resize moves and each one's rate per unit of the move (`SnapSide`), and `SnapCollect.boxAt(delta)` gives the box where a resolved move puts it.
