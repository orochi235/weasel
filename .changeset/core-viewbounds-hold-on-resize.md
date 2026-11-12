---
"@weasel-js/core": patch
---

`viewBounds` keeps the view inside it when the canvas resizes or is shown again, and clamps `defaultView`, not only a pan or a `setView`.

<!-- entry: fix behavior -->
