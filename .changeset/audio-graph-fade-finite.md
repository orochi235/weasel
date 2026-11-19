---
'@weasel-js/audio': patch
---

`createAudioGraph` throws a `RangeError` for a `fadeMs` that is not finite or is below 0, rather than throwing from the middle of a later edit.

<!-- entry: fix -->
