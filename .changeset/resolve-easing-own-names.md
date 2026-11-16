---
'@weasel-js/geom': patch
---

`resolveEasing` throws for a name like `'constructor'` or `'toString'` instead of returning an `Object` method as the easing.

<!-- entry: fix -->
