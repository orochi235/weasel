---
'@weasel-js/audio': patch
---

`playNote` and `createNoteKernel` throw a `RangeError` at the call on a harmonic `wave` that is empty or holds a level that is not finite.

<!-- entry: fix -->
