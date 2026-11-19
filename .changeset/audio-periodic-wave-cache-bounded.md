---
'@weasel-js/audio': patch
---

Harmonic waves are cached per context up to the 64 most recently played, and levels that differ only in scale share one wave, so a timbre varied note by note no longer grows memory without limit.

<!-- entry: fix perf -->
