---
'@weasel-js/routing': patch
---

A pointer session opened from a window capture-phase `pointerdown` listener stays open, instead of canceling at once as `'superseded'` by the press that opened it.

<!-- entry: fix -->
