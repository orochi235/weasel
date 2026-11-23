---
'@weasel-js/tiles': patch
---

A tile whose bake answered `null` and arrives on a later frame comes in stale, and so is baked again, when an edit met it in between.

<!-- entry: fix -->
