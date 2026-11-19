---
'@weasel-js/audio': patch
---

`stop(fadeMs)` fades a voice that is releasing or already fading from where it is, rather than cutting it dead.

`release()` on a fading voice leaves it to its fade, too.

<!-- entry: fix -->
