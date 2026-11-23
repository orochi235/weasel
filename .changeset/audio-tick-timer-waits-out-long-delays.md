---
'@weasel-js/audio': patch
---

`createTickTimer().setTimer` waits out a delay past 2^31 − 1 ms and never fires on `Infinity`.

<!-- entry: fix -->
