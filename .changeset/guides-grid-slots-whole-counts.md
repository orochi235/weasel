---
"@weasel-js/guides": patch
---

`gridSlots` rounds `cols` and `rows` down to whole counts, and gives no slots for under one column.

Columns that are not finite give no slots, and rows under one, or not finite, count as 1.

<!-- entry: fix -->
