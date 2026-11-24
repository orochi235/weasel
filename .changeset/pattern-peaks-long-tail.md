---
'@weasel-js/audio': patch
---

`patternVoicePeaks` returns at once for a looped event that rings for many passes, rather than running out of memory on a very long release or `hitMs`.

<!-- entry: fix perf -->
