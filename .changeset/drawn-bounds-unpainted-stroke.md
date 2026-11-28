---
'@weasel-js/core': patch
---

A stroke with no paint that only draws marker heads adds just the heads to a node's drawn box, so selection, alignment, and fit-to-content no longer reserve room for a line that is not drawn.

<!-- entry: fix -->
