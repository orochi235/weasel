---
'@weasel-js/editor': patch
---

`useSessionPersistence` drops the undo stack saved beside a scene whose load fell back, rather than replaying it.

<!-- entry: fix -->
