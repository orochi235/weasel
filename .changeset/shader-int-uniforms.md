---
'@weasel-js/renderer': patch
---

A shader command's `Int32Array` or `Uint32Array` uniform value writes a scalar `int`, `ivecN`, `uint`, or `uvecN` uniform, by its length.

Another length throws in development, as other unsupported values do.

<!-- entry: fix -->
