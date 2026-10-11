---
'@weasel-js/ui': patch
---

`Tree` copies on a drag with Alt held, and links on one with Alt and Cmd or Ctrl held. Given a new `onCopy(ids, target)` or `onLink(ids, target)` beside `onMove`, a drag released with those keys down calls it and leaves the rows where they are; `Tree` makes no copy and no link itself. While the keys are held the dragged rows are not dimmed, the ghost carries a plus or a link glyph, and a drop beside the row's own place is taken, since a second row there is not nothing. A key pressed or let go mid-drag switches at once. Without `onCopy` or `onLink`, the keys change nothing.

`canDrop`, `onDragOutside`, and `onDropOutside` each take a trailing `effect: 'move' | 'copy' | 'link'` (the new `TreeDragEffect`), so a host can refuse a copy it would allow as a move, or the reverse.

`PrefSchemaEditor` uses both. Alt-dragging a node in the structure tree, or a row, heading, or rail entry in the live preview, sets a copy of it where it is dropped; the copy keeps its key where that is free among its new siblings, and takes a numbered one (`grid2`) where it is not. With Cmd or Ctrl held as well, the drag sets an alias of a pref in place of a copy.
