---
'@weasel-js/diagram': patch
---

`setMessageArrow` returns the data it was given when the arrow differs only by an explicit `both: false` or `async: false`, so it no longer commits an empty undo entry.

<!-- entry: fix -->
