---
'@weasel-js/audio': patch
---

`AudioEngine.unlock()` resolves when `dispose()` closes the context while its resume is still pending, rather than rejecting with "AudioContext is closed".

<!-- entry: fix -->
