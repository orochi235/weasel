---
'@weasel-js/ui': patch
---

`Tree` waits out a `tree.hoverExpandMs` longer than 2³¹ − 1 ms before a drag opens the branch under it, instead of opening it at once.

<!-- entry: fix -->
