---
'@weasel-js/ui': patch
---

`createRecentColorsStore` reads a NaN `limit` as the default 12 and a fractional one as its whole part. A NaN limit kept every color ever recorded, in memory and in `localStorage`.
