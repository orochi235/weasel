---
'@weasel-js/clock': patch
---

A clock declared `start: 'end'` refuses to become endless. A `duration`, `loop`, `declare` or `override` that would make its run endless throws a `RangeError`, where `reset` threw later.

<!-- entry: fix behavior -->
