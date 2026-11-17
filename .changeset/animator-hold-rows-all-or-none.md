---
'@weasel-js/animator': patch
---

`animator.holdRows` that throws for one of its rows (not in the table, or moved by another animator) holds none of them, and a row not in the table refuses the call before it interrupts its `cancelKey`.

<!-- entry: fix -->
