---
'@weasel-js/editing': patch
---

`transformSelection` returns `false` instead of throwing when a transform follower would rewrite a locked node.

<!-- entry: fix -->
