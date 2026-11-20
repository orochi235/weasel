---
'@weasel-js/diagram': patch
---

`setMessageArrow` leaves the data as it was for an arrow differing only by an explicit `both: false` or `async: false`.

So it no longer commits an empty undo entry.

<!-- entry: fix -->
