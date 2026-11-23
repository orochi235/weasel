---
'@weasel-js/text-dom': patch
---

A text edit whose `container` changes moves there with what was typed, its selection, and its rewritten node style, rather than starting over.

The edit's undo steps start afresh in the new container.

<!-- entry: fix -->
