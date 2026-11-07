---
'@weasel-js/quantity': patch
---

`scientific` keeps its exponent in a locale that writes its own digits: in `ar-EG`, 1,234,567 showed as `١٫٢٣ × 10`, with the power dropped, and `1.23e6`'s form wrote `NaN` for it. Text in such a locale's digits now also reads back.
