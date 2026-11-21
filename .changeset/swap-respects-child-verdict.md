---
'@weasel-js/core': patch
'@weasel-js/editing': patch
---

Swapping two nodes under different parents is refused when either parent would not take the other node, as a drop into it would be: a locked, hidden, or singular container, or one `canDropInto` refuses.

<!-- entry: fix -->
