---
'@weasel-js/ui': patch
'@weasel-js/devtools': patch
---

`Tree` takes `pressFolds` (default `true`). Set to `false`, activating a branch — a click on its row, Enter, Space — selects it without folding it; the twisty, a `leading` that folds, and the arrow keys still fold. The schema editor's structure, unplaced and actions trees, and devtools' scene tree, set it, so picking a group to edit or inspect no longer hides what it holds.

The schema editor's printed literal leaves out a group's or a section's empty `description`, which the type makes optional, and its Changes list prints an object or an array value on one line without a trailing comma.
