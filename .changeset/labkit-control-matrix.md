---
'@weasel-js/labkit': patch
---

New `ControlMatrix` edits one setting across several config groups of the same shape: settings down the side, scopes across the top (`columns`, each a group's path prefix), a compact cell at each crossing. The first column is the fallback the others inherit from; a path in `auto` draws ghosted with a "from <first column>" tooltip (`inheritHint` changes the text). A boolean cell flips in place and a color cell opens its picker in place; any other cell opens a popover holding the control `ControlPanel` would draw for that leaf. Editing writes through `setConfig`, which pins the cell; the popover's Inherit button, or Option/Alt-click on a pinned cell, writes the `auto` sentinel to unpin it. A column whose group has no such leaf shows a dash. `onColumnClick` makes the headers buttons.
