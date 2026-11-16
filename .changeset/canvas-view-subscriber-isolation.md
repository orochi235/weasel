---
'@weasel-js/core': patch
---

A `subscribeView` listener that throws no longer stops the other listeners, `onViewChange` or the repaint, and one subscribed during a notify waits for the next.

<!-- entry: fix -->
