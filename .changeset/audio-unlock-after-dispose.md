---
'@weasel-js/audio': patch
---

`AudioEngine.unlock()` resolves, rather than rejecting, when `dispose()` closes the context during its resume.

<!-- entry: fix -->
