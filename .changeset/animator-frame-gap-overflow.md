---
"@weasel-js/animator": patch
---

Frames far apart on the clock no longer throw: the animator's clock stops at `Number.MAX_VALUE`, as an endless clock does. A frame gap past the double range counts as the largest double.

<!-- entry: fix -->
