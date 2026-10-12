---
'@weasel-js/core': patch
---

`createTargetTable({ axes })` keeps many like values as rows of numbers an animator can move: particles, dots, vertex colors. `table.add(value)` answers a row, `table.target(row)` is that row as a `Target`, so it tweens, springs, coasts, and holds like any other, and `table.shown` is every row's value on screen in one `Float64Array`, filled by the animator once a frame. `table.committed` holds the values the rows rest at, `table.set(row, value)` writes one, and `table.remove(row)` frees a row for the next `add`.

Reading 10,000 moving values through a target apiece costs about 140 ns each; the table's pass over them costs 3 to 4 ns a row, and the same at 100,000. A row that has a hold on it is read by itself, at a single target's cost.
