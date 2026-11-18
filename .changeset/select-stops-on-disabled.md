---
'@weasel-js/ui': patch
---

`Select`'s open list lands its arrow keys on a disabled option, which reads its reason and chooses nothing, rather than passing over it.

The closed trigger's arrow keys still pass over a disabled option, since they change the value as they go.

<!-- entry: behavior -->
