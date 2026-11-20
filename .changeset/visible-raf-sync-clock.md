---
'@weasel-js/react': patch
---

A `useVisibleRaf` loop whose `requestFrame` runs its callback before returning keeps running frames after the first.

<!-- entry: fix -->
