---
'@weasel-js/react': patch
---

`useVisibleRaf` ignores an intersection report that arrives after unmount or a StrictMode remount, so it no longer fires a stray `onSuspend`.

<!-- entry: fix -->
