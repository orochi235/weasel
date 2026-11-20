---
'@weasel-js/prefs': patch
'@weasel-js/prefs-editor': patch
---

Under a section root, the schema editor refuses a leaf key inside another leaf's value, such as `grid.size` beside `grid`.

A leaf moved there is numbered instead.

`keyClashes` reports such pairs in a schema made elsewhere.

<!-- entry: fix -->
