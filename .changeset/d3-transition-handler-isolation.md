---
'@weasel-js/d3': patch
---

A transition handler from `on()` that throws no longer stops the other handlers or leaves `end()` unsettled.

The error goes to `console.error`.

<!-- entry: fix -->
