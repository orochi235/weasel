---
'@weasel-js/animator': patch
---

A timeline canceled by its own event handler at a lap's seam, or by a track's `onTick`, holds no target afterward and fires no more events that frame.

<!-- entry: fix -->
