---
'@weasel-js/ui': patch
---

Dragging one step of a `TokenPanel` scale writes only that step, even when the others hold more decimal places than the slider rounds to.

<!-- entry: fix -->
