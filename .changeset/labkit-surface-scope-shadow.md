---
'@weasel-js/labkit': patch
---

A surface scoped to an element keeps the tiles inside shadow roots below it, so they stay painted and `useTileInScope` reads true for them.

<!-- entry: fix -->
