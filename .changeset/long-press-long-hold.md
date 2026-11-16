---
'@weasel-js/routing': patch
---

The gesture dispatcher waits out a long-press `duration` longer than 2³¹ − 1 ms, and never fires on an infinite one, instead of firing the long-press as the press lands.

<!-- entry: fix -->
