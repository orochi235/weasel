---
'@weasel-js/core': patch
---

A path from `pathFromParts` keeps an `evenodd` part's holes empty for picking and every reader of the derived path, however many parts it has.

<!-- entry: fix -->
