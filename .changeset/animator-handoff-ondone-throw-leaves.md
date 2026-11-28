---
'@weasel-js/animator': patch
---

A compositor run taken back to the main thread leaves the animator when its `onDone` throws, rather than staying active.

<!-- entry: fix -->
