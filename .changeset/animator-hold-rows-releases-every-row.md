---
'@weasel-js/animator': patch
---

A rows hold lets go of every row it holds when one row's setter throws as it commits, rather than keeping the rows after it held.

<!-- entry: fix -->
