---
'@weasel-js/animator': patch
---

`animator.holdRows` holds none of its rows when one of them throws. A row not in the table refuses the call before it interrupts its `cancelKey`.

<!-- entry: fix -->
