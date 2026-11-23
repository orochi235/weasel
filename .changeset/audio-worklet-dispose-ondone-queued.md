---
'@weasel-js/audio': patch
---

With `synthVoices: 'worklet'`, an `onDone` that throws no longer cuts `engine.dispose()` short.

<!-- entry: fix -->
