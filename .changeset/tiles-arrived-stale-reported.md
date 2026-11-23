---
'@weasel-js/tiles': patch
---

A tile whose bake arrives after an edit met it is listed in its frame's `stale` and counted in `pending`, so a caller asking for frames while anything is pending goes on to rebake it.

<!-- entry: fix -->
