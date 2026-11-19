---
'@weasel-js/audio': patch
---

Harmonic waves are cached per context up to the 64 most recently played, so a timbre varied note by note stays bounded.

Levels that differ only in scale share one wave.

<!-- entry: fix perf -->
