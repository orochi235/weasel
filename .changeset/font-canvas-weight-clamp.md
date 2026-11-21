---
'@weasel-js/font': patch
---

The canvas font tier draws a weight outside 1 to 1000 at the nearer end, and one that is not a number at 400.

A weight that is not a number also warns once.

<!-- entry: fix visual -->
