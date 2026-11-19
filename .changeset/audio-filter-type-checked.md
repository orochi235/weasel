---
'@weasel-js/audio': patch
---

A voice filter, `createFilterEffect`, `createFilterNode`, and `biquadCoefficients` throw a `RangeError` on a filter `type` a `BiquadFilterNode` does not have.

<!-- entry: fix -->
