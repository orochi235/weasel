---
'@weasel-js/geom': patch
---

`trimNumber` leaves a large number that already has no more decimals than asked as it is, rather than moving its last digits.

<!-- entry: fix -->
