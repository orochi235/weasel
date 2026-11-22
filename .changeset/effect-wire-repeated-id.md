---
"@weasel-js/diagram": patch
---

Deleting or reconnecting a wire in the effect editor changes only that wire when another wire shares its id.

`ensureWireIds` now gives a wire repeating an earlier wire's id one of its own.

<!-- entry: fix -->
