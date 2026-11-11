---
"@weasel-js/text-shaping": patch
---

`glyphD` writes an offset of 1e21 ems or more as plain digits, as its doc promises, rather than exponent notation an SVG path parser misreads.

<!-- entry: rank=-5 fix -->
