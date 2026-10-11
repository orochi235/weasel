---
'@weasel-js/audio': patch
---

A voice whose node threw as it started, such as `engine.play(sound, { when: -1 })` or `engine.stream(el)` on an element another engine already routed, kept its pool slot and its place on the bus for the life of the engine: `activeVoices()` counted it and `handle.isPlaying()` stayed `true`. The voice is now torn down before the error is reported.
