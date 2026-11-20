---
'@weasel-js/icons': patch
---

Icon registry entries keep their order when a table is released and added back in one tick.

An `IconRegistryProvider` handed a new `icons` array each render does this.

<!-- entry: fix -->
