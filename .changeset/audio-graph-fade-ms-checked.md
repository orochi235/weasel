---
'@weasel-js/audio': patch
---

`createAudioGraph` throws a `RangeError` on a `fadeMs` that is not finite or is below 0.

<!-- entry: fix -->
