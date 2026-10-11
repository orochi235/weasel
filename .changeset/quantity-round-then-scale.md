---
'@weasel-js/quantity': patch
---

`formatCompact` and the `bytes` kind chose a magnitude before rounding, so a value just under one printed at the wrong width: `formatCompact(999.6)` gave `1000` instead of `1.00K`, and 999,999 bytes showed `1,000 kB` instead of `1 MB`. Both now choose from the rounded value.

`parseNumber` read `0x10` as 16, `0b11` as 3, `0xb` as 233, and `1e400` as Infinity. Text that is not a decimal number, or is too large to be one, now reads as NaN.
