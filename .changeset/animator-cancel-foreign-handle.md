---
'@weasel-js/animator': patch
---

`animator.cancel(handle)` cancels the handle's own animation, as `handle.cancel()` does, and never another one of this animator's that shares its id.

<!-- entry: fix -->
