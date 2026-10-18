---
'@weasel-js/svg': patch
---

`svgNodesToKitDrafts` takes a `keepEmpty` option: an empty group it returns true for is drafted as a container — at its clip's box, or a zero box at the origin — instead of being dropped, and so is any group holding one. Without the option nothing changes.
