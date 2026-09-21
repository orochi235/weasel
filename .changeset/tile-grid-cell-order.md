---
'@weasel-js/core': patch
---

Compact a tile grid's resting arrangement in current cell order rather than by
sorted id. Drops, swaps and occupancy already went by where a child's pose sits,
so the reflow that ran when a child left the grid re-sorted the survivors and
undid any earlier swap among them. Children sitting in no cell still sort last,
by id, so a grid nobody has arranged yet fills the same way it did.
