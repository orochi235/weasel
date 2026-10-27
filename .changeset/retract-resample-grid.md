---
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

`core:retractHandles` and `path-tools:resamplePath` are redrawn on the 16px pixel grid. `retractHandles`'s corner runs on the pixel diagonal and its arrows carry 45-degree heads; `resamplePath`'s anchors are two pixels square on pixel corners, so they no longer blur at 1x.
