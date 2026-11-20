---
'@weasel-js/editing': patch
---

A resize flips a node through its anchor on an axis its `data.minSize` leaves at 0, rather than collapsing it to nothing.

<!-- entry: fix -->
