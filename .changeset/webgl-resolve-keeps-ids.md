---
'@weasel-js/renderer': patch
---

On WebGL, resolving into a target made with `ids: true` leaves its pick ids in place, so `readIds` still reads ids afterward.

<!-- entry: fix -->
