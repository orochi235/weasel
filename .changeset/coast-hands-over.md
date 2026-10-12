---
'@weasel-js/core': patch
---

A `tweenPose` or `springPose` of a node that `momentum` is coasting no longer makes it jump. The coast still ends, and the distance it had traveled now springs to nothing from the coast's speed, under the node's `pose:<id>` key, where it used to vanish in one frame.
