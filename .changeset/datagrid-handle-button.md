---
'@weasel-js/ui': patch
---

Fixes: a `DataGrid` with `onReorder` could move a row by pointer only, and its handle was a bare cell with the press handler on the `<td>`. The handle is now a `<button>` filling that cell: it takes the drag, and Alt+ArrowUp or Alt+ArrowDown on it moves the row one place and keeps focus on it.

Adds API: `rowLabel` on `DataGrid`, what a row is called. A handle is named `Reorder <label>`, and `Reorder row <n>` without it.

A stylesheet that styled the handle through the cell (`td:first-child`) now reaches a cell with no padding and a button inside it.
