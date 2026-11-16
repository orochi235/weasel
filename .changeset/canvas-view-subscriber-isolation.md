---
'@weasel-js/core': patch
---

A `subscribeView` listener that throws no longer stops the other listeners, `onViewChange` or the repaint.

One subscribed while the others are told waits for the next change.

<!-- entry: fix -->
