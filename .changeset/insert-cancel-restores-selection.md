---
'@weasel-js/core': patch
---

Starting a draw with `insertAction` clears the selection, and pressing Escape mid-draw left it cleared although nothing was created. A canceled insert now puts the selection back.
