---
'@weasel-js/audio': patch
---

A `synthVoices: 'worklet'` voice that the audio thread has started while a main-thread stall kept the scheduler from reaching it now releases on `release()` and fades on `stop(fadeMs)`, where it used to be cut at once. It reports `onDone` when it ends, not `onDrop('stopped')`, because it sounded. `stopKey` treats such a voice the same way.
