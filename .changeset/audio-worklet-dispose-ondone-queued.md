---
'@weasel-js/audio': patch
---

With `synthVoices: 'worklet'`, `engine.dispose()` finishes tearing down before a voice it ends reports `onDone`, so an `onDone` that throws no longer leaves the context and graph open.

<!-- entry: fix -->
