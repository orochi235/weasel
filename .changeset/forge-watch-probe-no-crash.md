---
'@weasel-js/forge': patch
---

`watchProbe()` warns that it could not check the file watcher when it cannot write its temp file. The dev server no longer exits on the unhandled rejection.

<!-- entry: fix -->
