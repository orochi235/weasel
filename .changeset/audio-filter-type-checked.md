---
'@weasel-js/audio': patch
---

Voice filters, `createFilterEffect`, `createFilterNode`, and `biquadCoefficients` throw a `RangeError` on an unknown filter `type`.

<!-- entry: fix -->
