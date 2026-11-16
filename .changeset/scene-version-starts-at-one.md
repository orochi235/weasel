---
'@weasel-js/core': patch
---

A new scene starts at version 1, so a canvas's `getPaintedVersion()` of `0` again means nothing has been painted yet.

A canvas given no `contentVersion` reports `1` once it has painted. A `contentVersion` of your own should start at 1 or above.

<!-- entry: behavior -->
