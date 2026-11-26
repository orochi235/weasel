---
'@weasel-js/renderer': patch
---

A registered texture drawn from a command list built before its `unregister` is freed on the next frame, rather than held until the texture registry next changes.

<!-- entry: fix -->
