---
'@weasel-js/routing': patch
---

A pointer over a dispatcher surface nested inside another counts as having left the outer one. The outer surface sends no hover, shows no cursor, and stops hearing `over` key bindings there.

<!-- entry: fix -->
