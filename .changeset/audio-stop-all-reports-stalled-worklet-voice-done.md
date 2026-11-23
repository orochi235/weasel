---
'@weasel-js/audio': patch
---

`stopAll()` reports a worklet voice that the audio thread had already started during a main-thread stall through `onDone`, as `stop()` and `cancelKey()` do, rather than as dropped.

<!-- entry: fix -->
