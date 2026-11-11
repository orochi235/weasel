---
"@weasel-js/ui": patch
---

The token panel reads a number written with a sign or an exponent, as CSS does: an amount it wrote back as `1e+21px` or `1e-7` was read as no amount at all, typed as a string, and lost its field. `inferTokenType` types such values as numbers, dimensions, durations, and `cubic-bezier()` easings.
