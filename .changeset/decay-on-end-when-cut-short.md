---
'@weasel-js/core': minor
---

`useDecayLoop` calls a coast's `onEnd` when `cancel`, a new `start`, or an unmount cuts it short, passing `'cancel'`; a coast that comes to rest passes `'end'`.

<!-- entry: fix api -->
