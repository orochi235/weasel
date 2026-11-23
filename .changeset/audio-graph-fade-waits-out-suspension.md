---
'@weasel-js/audio': patch
---

An audio graph's crossfades and output fades no longer click when a suspended context resumes mid-fade. The fade finishes after the resume rather than being cut.

<!-- entry: fix -->
