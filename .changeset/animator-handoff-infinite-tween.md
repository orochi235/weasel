---
'@weasel-js/animator': patch
---

A target tween with `ms: Infinity` and `compositor: 'auto'` runs on the main thread rather than throwing. `compositor: 'require'` refuses it.

<!-- entry: fix -->
