---
'@weasel-js/ui': minor
---

`CycleButton` takes a `Button`'s native attributes and handlers, and forwards its `ref`.

Its `onClick` runs before the cycle, and one that calls `preventDefault()` keeps the value where it is.

<!-- entry: api -->
