---
'@weasel-js/editing': patch
---

Two `snapToContainer` behaviors on one binding each keep their own dwell, so one finishing over its container no longer depends on the other.

<!-- entry: fix -->
