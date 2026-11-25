---
'@weasel-js/editing': patch
---

A `snapBackOrDelete` drag released far away deletes a dragged node inside another dragged node once, with its ancestor, so undo restores both in order.

<!-- entry: fix -->
