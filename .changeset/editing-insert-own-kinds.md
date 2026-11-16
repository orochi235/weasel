---
'@weasel-js/editing': patch
---

An insert of a kind named `constructor` or `toString` finds no factory and inserts nothing, rather than calling a built-in as the node factory.

<!-- entry: fix -->
