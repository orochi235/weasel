---
'@weasel-js/editor': patch
---

`adoptSnapshotPages` refuses a `core:pages` value whose layout has a `direction`, `gap`, `align` or `origin` the page layout cannot read.

<!-- entry: fix data -->
