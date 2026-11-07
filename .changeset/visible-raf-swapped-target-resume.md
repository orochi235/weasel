---
'@weasel-js/react': patch
---

`useVisibleRaf` now runs `onResume` when a loop suspended because its element left the viewport is
requested again after its `target` names a different element. It used to start the new element's
frames with the loop still marked suspended, so `onResume` never ran, a loop that measures elapsed
time took the whole suspension as one frame, and the next hide did not run `onSuspend`.
