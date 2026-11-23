---
'@weasel-js/audio': patch
---

An insert crossfade that a context suspension interrupts finishes after the context resumes rather than being cut, so adding or removing an effect no longer clicks on resume; `inserts.settled()` resolves once it does.

<!-- entry: fix -->
