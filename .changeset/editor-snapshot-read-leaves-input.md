---
"@weasel-js/editor": patch
---

`nodeSpecsFromSnapshot` hands `revive` a copy of each node's data, so the snapshot it reads is left as it was. The default reviver works in place, so a first read took a value off the writer's `{ "__raw": … }` wrapper inside the caller's snapshot, a second read of it then took that value for a tagged typed array, and both reads' results, which shared it, changed.
