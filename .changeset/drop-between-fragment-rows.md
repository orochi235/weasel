---
'@weasel-js/ui': patch
---

`prefDropTargetAt` answered a point in the gap between two rows of an `as: 'fragment'` group with a drop into the enclosing page or section, so a placeholder dragged down through a fragment jumped to the end of the page at each gap. The gap now belongs to the nearest row, as it does between rows outside a fragment.
