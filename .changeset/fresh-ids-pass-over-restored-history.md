---
'@weasel-js/core': patch
---

A scene mints no id that a history restored with `restoreHistory` adds or removes, so undoing a restored removal brings its node back.

This holds under a `generateId` that restarts with the session.

<!-- entry: fix -->
