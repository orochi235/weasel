---
'@weasel-js/routing': patch
---

`useHandleDrag` follows a scroll outside the shadow root its rect element is in, and inside the shadow root a slotted one is shown in.

<!-- entry: fix -->
