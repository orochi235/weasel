---
"@weasel-js/editor": patch
---

`nodeSpecsFromSnapshot` leaves the snapshot it reads unchanged, handing `revive` a copy of each node's data.

<!-- entry: rank=-5 fix -->
