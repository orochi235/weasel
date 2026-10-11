---
'@weasel-js/ui': patch
---

`LayerList` selects as `Tree` does: shift-click selects every showing row from the last click to this one, and Cmd/Ctrl-click adds or removes one row. Shift-click used to toggle a single row, so this changes what an existing shift-click does.
