---
'@weasel-js/select': patch
---

`createSelectionStore` keeps its own copy of the ids it is given, so mutating that array later leaves the selection as it was.

<!-- entry: fix -->
