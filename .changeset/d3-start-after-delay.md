---
'@weasel-js/d3': patch
---

A delayed transition fires `start`, and reads each node's starting pose and custom tween `from`, when its delay ends rather than when it is scheduled.

An item interrupted during its delay no longer fires `start`.

<!-- entry: fix -->
