---
'@weasel-js/core': patch
---

Undoing a `setHidden` or `setLocked` that cleared the flag drops the node from every editing session's selection, as setting the flag does.

<!-- entry: fix -->
