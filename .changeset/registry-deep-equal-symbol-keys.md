---
'@weasel-js/registry': patch
---

`deepEqual` compares symbol-keyed properties, so two objects differing only under a symbol key are no longer equal.

<!-- entry: fix -->
