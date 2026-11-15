---
'@weasel-js/core': patch
---

The `kit:path`, `kit:path-pose`, and `kit:derived` painters build their draw command in one place, so a change to how a path's fill and stroke are drawn reaches all three.

<!-- entry: internal -->
