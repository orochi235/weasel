---
'@weasel-js/diagram': patch
---

A node sized to its rows under a `roundRectOutline` gets the box its drawn corners need; `Infinity` no longer sizes an infinite one.

A radius that is negative or `NaN` now throws a `RangeError`.

<!-- entry: fix visual -->
