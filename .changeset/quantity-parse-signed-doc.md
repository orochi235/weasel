---
'@weasel-js/quantity': patch
---

`parseSignedNumber`'s docs called it the inverse of `formatNumber`, which writes `1,234` for a thousand and up; it reads that as NaN. The docs now say so and point at `parseNumber`, which reads the grouped form back.
