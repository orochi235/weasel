---
'@weasel-js/core': patch
---

`scenePoseTarget` answers undefined for a node deleted after its animation came to rest

The scene's table of pose targets no longer keeps one for every node that was animated and then deleted, so `tweenPose`, `springPose` and clip tracks treat such an id as a node that is not there.

<!-- entry: fix -->
