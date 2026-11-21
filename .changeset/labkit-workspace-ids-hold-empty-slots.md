---
'@weasel-js/labkit': patch
---

`Workspace` matches `ids` to children with an empty child (`null`, `false`) holding its place.

A tile keeps its id, extent, and mount while a sibling before it comes and goes.

<!-- entry: fix -->
