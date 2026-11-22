---
'@weasel-js/diagram': patch
---

Lane boundaries, lane resize, and `lanesOf` read a pool's lanes in the order the pool stacks them, even while lanes overlap.

<!-- entry: fix -->
