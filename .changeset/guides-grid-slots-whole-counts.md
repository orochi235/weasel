---
"@weasel-js/guides": patch
---

`gridSlots` rounds `cols` and `rows` down; with under one column, or columns that are not finite, it gives no slots, and rows under one, or not finite, are 1. A negative column count placed slots outside the container, and zero or `NaN` placed them at `NaN`.
