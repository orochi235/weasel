---
'@weasel-js/core': patch
---

Fixes: picking a node whose pose carries a `transform` measured the grab tolerance in the node's own frame, so a node stretched four times as wide could be picked four times as far from its edge, and a screen slop was stretched the same way. A world tolerance, the default path slop, and a screen slop are now all measured where they are stated, through the node's whole frame. A `PoseSlop`'s `reach` stays in the node's frame, where the stroke it stands for is drawn.
