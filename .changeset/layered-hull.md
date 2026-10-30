---
'@weasel-js/diagram': patch
---

`layered` keeps long edges inside the drawing. Where a run of placeholders sits past the node that sets the
drawing's edge in its rank, that node now moves beyond the run, so the wire no longer runs outside every node
and group box for its whole length; a run going around its own sibling (a skip edge) stays where it was. A
wire passing a group's box now enters and leaves level with the box's edge, so its turns clear the box. The
`bezier` router no longer lets a leg between two facing ports swing past either end along the axis they face,
which flattens long legs between near ranks. All three change where nodes land and how wires are drawn.
