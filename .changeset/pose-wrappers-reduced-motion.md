---
'@weasel-js/core': patch
---

`animateOnSetPose` and `animateLifecycle` given no `ms` move nodes at once under `prefers-reduced-motion`, as a reflow does.

<!-- entry: behavior -->
