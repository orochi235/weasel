---
'@weasel-js/text-dom': patch
---

Taking italic off a selection in an italic text node styles only the selection, and no longer marks the node's own style as changed on commit.

<!-- entry: fix -->
