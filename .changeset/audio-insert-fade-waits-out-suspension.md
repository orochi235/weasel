---
'@weasel-js/audio': patch
---

Adding or removing an insert effect no longer clicks when a suspended context resumes mid-crossfade. The crossfade finishes after the resume, and `inserts.settled()` resolves once it does.

<!-- entry: fix -->
