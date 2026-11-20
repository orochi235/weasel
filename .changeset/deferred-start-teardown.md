---
'@weasel-js/routing': patch
---

A drag-threshold action whose `start` ends every gesture has the handle it returns canceled. That covers a `cancelAll`, a tool switch, or an unmount inside `start`, as for an action with no threshold.

<!-- entry: fix -->
