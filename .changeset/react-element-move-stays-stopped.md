---
'@weasel-js/react': patch
---

`watchElementMove` stays stopped: a report already on its way, or a stop made from inside `onMove`, no longer starts it watching again.

<!-- entry: fix -->
