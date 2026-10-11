---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` takes `rowMark`: a function from a node's path in `original` to something to draw on its row in the structure tree, before the kind badge. Asking by the original path means a mark follows a node the reader moves.

With a `draftKey`, the structure tree's folded rows are kept in `localStorage` beside it, and the editor opens with them folded.
