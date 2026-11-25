---
'@weasel-js/forge': patch
---

forge's story indexer and component graph read a `var` inside a class `static {}` block as the block's own, not as a use of a top-level name or a variable of the function around it.

<!-- entry: fix -->
