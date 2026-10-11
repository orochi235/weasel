---
'@weasel-js/audio': patch
---

`onDone` is now documented as what it is: a voice's source ended. A voice that never played reports through a new `onDrop(reason)` option on `play`, `playNote`, `playNoise`, and `stream`, raised when the context is locked, the engine is disposed, the voice is stopped before it comes due, its sound is not loaded, its node fails to start, or it came due during a suspension. `VoiceDropReason` is exported.
