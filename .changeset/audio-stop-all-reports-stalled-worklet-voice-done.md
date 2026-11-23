---
'@weasel-js/audio': patch
---

`stopAll()` reports a worklet voice the audio thread already started through `onDone`, not as dropped. This matches `stop()` and `cancelKey()`.

<!-- entry: fix -->
