---
'@weasel-js/renderer': patch
---

The `retainBudget` docs count both scratch buffers: GPU memory can reach the budget plus 44 MiB at 4x, not 36.

<!-- entry: fix -->
