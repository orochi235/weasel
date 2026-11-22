---
'@weasel-js/ui': patch
---

`GradientEditor` calls `onSelectionChange` when removing the selected first stop selects its neighbor.

This holds whenever the neighbor lands at the index the removed stop had.

<!-- entry: fix -->
