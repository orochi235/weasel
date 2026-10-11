---
'@weasel-js/ui': patch
---

`Tree` copies on a drag with Alt held. Given a new `onCopy(ids, target)` beside `onMove`, a drag released with Alt down calls it and leaves the rows where they are; `Tree` makes no copy itself. While Alt is held the dragged rows are not dimmed, the ghost carries a plus, and a drop beside the row's own place is taken, since a copy there is a second row and not nothing. Alt pressed or let go mid-drag switches at once. Without `onCopy`, Alt changes nothing.

`canDrop`, `onDragOutside`, and `onDropOutside` each take a trailing `how: { copy: boolean }` (the new `TreeDragHow`), so a host can refuse a copy it would allow as a move, or the reverse.

`PrefSchemaEditor` uses it: Alt-dragging a node in the structure tree, or a row, heading, or rail entry in the live preview, sets a copy of it where it is dropped. The copy keeps its key where that is free among its new siblings, and takes a numbered one (`grid2`) where it is not.
