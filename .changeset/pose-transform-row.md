---
'@weasel-js/core': patch
---

The default node properties have a Skew row for `pose.transform`, in Layout under Rotation. It reads on while a node's pose carries a skew or a per-axis scale, and turning it off removes the transform, so `SelectionPanel` can show and clear one. Additive: the row is a switch, not a matrix editor, and turning it on writes nothing new.
