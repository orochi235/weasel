---
'@weasel-js/animator': patch
---

Holds cost a frame much less. A hold on a target table's row keeps its value and weight in the table's own arrays, and the table shows its held rows in the same pass that shows its moving ones: at 10,000 rows, a hold whose value is a function went from about 730 to 100 ns a row a frame, and one of plain values from 12 to 4. A timeline track or rig clip with a constant weight is read only when the playhead moves it.

`animator.holdRows({ table, rows?, weight?, axes? })` holds many rows of a table at once. Its handle's `values` (laid out as `table.committed`) and `weights` (one a row) are written in place, then shown with `touch()`; each row is a hold like any other, mixed with the row's other holds, covering the moves behind it, and committing what it showed when released or canceled. A row stopped through its target, or removed from the table, is let go of.
