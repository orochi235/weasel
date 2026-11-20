---
'@weasel-js/diagram': minor
---

`diagramDropParentAt` takes an optional `canDropInto` asking which regions admit an insert.

It defaults to `diagramCanDropInto` on the scene, and reads `isLocked` and `isHidden` off the scene when it has them.

<!-- entry: api -->
