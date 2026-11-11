---
"@weasel-js/audio": patch
---

`impulseResponse` throws its own `RangeError` for a length that is not finite, a decay that is not finite or rises more than 770 dB, and a channel count that is not a whole number above 0. A decay of `Infinity` wrote a `NaN` first sample and one rising past float32's range wrote `Infinity`; a fractional channel count threw a `TypeError` and an endless length or a count of 0 threw the context's own error.
