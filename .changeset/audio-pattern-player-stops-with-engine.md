---
'@weasel-js/audio': patch
---

A pattern player, and a score, report `isPlaying()` false once their engine is disposed, and `start()` on a disposed engine leaves them stopped, so a score can be started again on a new engine.

<!-- entry: fix -->
