---
'@weasel-js/core': minor
---

`layoutPages` throws on a `direction`, `gap`, `align` or `origin` it cannot read.

Loading a scene refuses a page run whose layout holds one, and `pageLayoutFault(value)` says what is wrong with one, or returns `null`.

<!-- entry: fix api data -->
