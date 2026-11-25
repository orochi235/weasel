---
'@weasel-js/history': patch
---

A failed step finishes unwinding when an op or `onEvict` throws a value with no text, such as an object with no prototype.

<!-- entry: fix -->
