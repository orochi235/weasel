---
'@weasel-js/font': patch
---

`registerCanvasFont` keeps a family registered until every caller that registered it has called its disposer.

Each call's disposer now releases that call's own hold. `unregisterCanvasFont` still removes the family outright.

<!-- entry: fix behavior -->
