---
'@weasel-js/core': patch
---

Align and distribute move their members the way a move does. A node whose pose derives from others now moves through what it derives from, where before its own pose was written and then overwritten on the next read, so it stayed put. Data-held geometry (the `geometryProjection` dep) now moves with the pose, where before only the pose moved. Both commit through the `applyOps` dep when one is wired, as flip and nudge do, rather than straight to the scene.
