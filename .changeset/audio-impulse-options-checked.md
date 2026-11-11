---
"@weasel-js/audio": patch
---

`impulseResponse` throws a `RangeError` for a length, decay or channel count it cannot render. The length must be finite, the decay finite and rising no more than 770 dB, and the channel count a whole number above 0.

<!-- entry: rank=-5 fix -->
