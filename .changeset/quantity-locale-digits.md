---
'@weasel-js/quantity': patch
---

`parseNumber` and the display parsers now read the digits a locale writes in, so `١٬٢٣٤` typed in `ar-EG` is 1234 rather than NaN. A duration typed on the clock takes the locale's decimal mark before its fraction of a second, so `4:05,5` reads as 245.5 in `de-DE`.
