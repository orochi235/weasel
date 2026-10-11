---
'@weasel-js/core': patch
---

`animateLifecycle`: a node whose exit tween was canceled (the canvas unmounting, `animator.cancelAll()`, another pose animation on the same node) stayed in the scene at a half-finished exit pose. The node is now removed when its exit ends for any reason.
