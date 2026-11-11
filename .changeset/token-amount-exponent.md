---
"@weasel-js/ui": patch
---

The token panel reads a number written with a sign or an exponent, such as `1e+21px` or `1e-7`, as CSS does, and keeps its field.

`inferTokenType` types such values as numbers, dimensions, durations and `cubic-bezier()` easings.

<!-- entry: fix -->
