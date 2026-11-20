---
'@weasel-js/diagram-formats': patch
---

The Diagram JSON reader refuses a page it could not draw, naming it.

That is a page with no id, size or `data`, or a graph page without `nodes` and `edges` lists.

<!-- entry: fix -->
