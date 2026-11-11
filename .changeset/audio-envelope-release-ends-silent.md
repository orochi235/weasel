---
"@weasel-js/audio": patch
---

`envelopeLevel` is 0 from `gate + release` on, as `envelopePoints` and the voice kernels end there, instead of a small level left over where rounding put that sum less than a whole release past the gate.
