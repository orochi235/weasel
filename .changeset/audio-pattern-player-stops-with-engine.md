---
'@weasel-js/audio': patch
---

A pattern player and a score report `isPlaying()` false once their engine is disposed. `start()` on a disposed engine leaves them stopped.

<!-- entry: fix -->
