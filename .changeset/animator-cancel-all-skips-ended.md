---
'@weasel-js/animator': patch
---

`animator.cancelAll()` called from an `onDone` reports no `cancel` event for the animation that just ended, as `handle.cancel()` reports none.

<!-- entry: fix -->
