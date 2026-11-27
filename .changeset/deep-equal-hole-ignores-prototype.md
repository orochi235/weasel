---
'@weasel-js/registry': patch
---

`deepEqual` reads an array's hole as `undefined` even where its prototype holds a value at that index.

<!-- entry: fix -->
