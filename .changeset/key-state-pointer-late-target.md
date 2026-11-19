---
'@weasel-js/core': patch
---

`useKeyState({ target })` and `usePublishPointer` attach to an element that mounts after the hook first runs, or replaces the one it had.

<!-- entry: fix -->
