---
'@weasel-js/routing': patch
---

`startThresholdDrag` ends a drag, not a click, on a release past the threshold that no move crossed. It calls `onStart` then `onEnd` there.

<!-- entry: fix -->
