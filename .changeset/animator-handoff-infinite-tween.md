---
'@weasel-js/animator': patch
---

A target tween with `ms: Infinity` and `compositor: 'auto'` runs on the main thread rather than throwing from `Element.animate`; `compositor: 'require'` refuses it.

<!-- entry: fix -->
