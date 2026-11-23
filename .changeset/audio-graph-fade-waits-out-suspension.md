---
'@weasel-js/audio': patch
---

An audio graph's crossfade or output fade that a context suspension interrupts finishes after the context resumes rather than being cut, so a `replace` or `stop` no longer clicks on resume.

<!-- entry: fix -->
