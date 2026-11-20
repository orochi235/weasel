---
'@weasel-js/d3': patch
---

A second transition on a joined selection tweens each node from where it stands, instead of snapping it back to its pose before the join.

Only the first transition to start on a node after its join tweens it from its prior pose; a later one without `.pose()`, such as one named for a custom tween, leaves the pose alone. A transition with nothing to tween still interrupts the one of its name on its nodes.

<!-- entry: fix -->
