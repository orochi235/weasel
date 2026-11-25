---
'@weasel-js/editing': patch
---

`selectFromLasso` selects by the lasso's bounds through `hitTestArea` when its adapter has no `hitTestLasso`, and still clears on a tiny lasso.

<!-- entry: fix -->
