---
'@weasel-js/diagram': patch
---

A pool drawn narrower than its header builds its lanes, and `addLane` adds one, inside its body rather than at a negative width.

<!-- entry: fix -->
