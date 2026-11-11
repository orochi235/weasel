---
"@weasel-js/labkit": patch
---

A trial config write that changes nothing, or a drag that ends where it began, records no undo step.

A write of the value a path already holds, including `auto` over a path already auto, also runs no `onConfigChange`.

<!-- entry: fix -->
