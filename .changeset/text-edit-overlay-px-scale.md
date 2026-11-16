---
'@weasel-js/core': patch
---

Editing a text node whose `fontSize` or `letterSpacing` is `{ px }` opens the overlay at the size the canvas draws it, rather than scaled by the zoom.

<!-- entry: fix visual -->
