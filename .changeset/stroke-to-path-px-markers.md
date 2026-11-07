---
'@weasel-js/stroke': patch
---

`strokeToPath` reads a marker sized `{ px }` at its `scale` option, as it does a `{ px }` width. A head under any scale but 1 used to come back sized as though the view were at 1, along with the gap cut from the line under it.
