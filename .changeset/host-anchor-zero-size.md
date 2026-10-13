---
'@weasel-js/core': patch
---

Fixes: a panel held by `useHostAnchor` stopped following a host that had no width or height when the hook began watching it. The watch now starts once the host has a size.
