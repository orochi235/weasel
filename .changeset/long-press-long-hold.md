---
'@weasel-js/routing': patch
---

The gesture dispatcher waits out a long-press `duration` past 2³¹ − 1 ms, and never fires on an infinite one.

<!-- entry: fix -->
