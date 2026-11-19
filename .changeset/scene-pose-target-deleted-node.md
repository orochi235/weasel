---
'@weasel-js/core': patch
---

`scenePoseTarget` answers `undefined` for a node deleted while at rest, and stops holding the targets of deleted nodes for the scene's lifetime.

<!-- entry: fix -->
