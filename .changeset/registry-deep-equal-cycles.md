---
'@weasel-js/registry': patch
---

`deepEqual` compares values that hold themselves, such as an object whose property is the object, by shape instead of overflowing the stack.

<!-- entry: fix -->
