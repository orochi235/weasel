---
'@weasel-js/ui': patch
---

`PrefsForm` and `PrefsDialog` show where a drag would land by laying out as they would after the drop. They take `drop` (a `PrefDrop`: where, the nodes dragged, and the paths those sit at in this schema) in place of `dropMark`: the nodes are drawn at the mark as dashed placeholders, the rows around them move aside, and a node dragged from the form is no longer drawn where it was. The bar on one edge of a row and the ring round a group are gone. This is a breaking change for a caller that passed `dropMark`.

`prefDropTargetAt(root, x, y)` no longer takes a split axis: the form knows which of its rows share a line. While a form draws a drop it is read as it lay before the drop, so a pointer held still keeps one answer however the rows move under it, and the gaps between rows belong to the nearest row. A rail entry takes a drop beside it from its top and bottom edges and into it from its middle.

In `PrefSchemaEditor`, a drag from the palette, the tree, or the preview reflows the live preview this way, and an entry in the preview's rail can be picked up and dropped among the others to reorder pages. The ghost beside the pointer hides while the preview draws the node in place.
