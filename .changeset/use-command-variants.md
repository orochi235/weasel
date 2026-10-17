---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

`useCommand` takes `variants`, and its callback receives the params it was triggered with, so a parametric command — one entry per variant in a bar, menu or palette — needs no hand-built `Action`. Additive.
