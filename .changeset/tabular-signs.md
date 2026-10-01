---
'@weasel-js/theme': patch
'@weasel-js/labkit': patch
---

`Oswald Tabular` now carries a plus (U+002B) and a minus (U+2212) at a digit's width, so a column of signed figures set in `--wzl-font-numeric` lines up on its digits. The minus is rebuilt from the plus's crossbar: Oswald draws its own minus shorter than that arm, so `+5` over `−5` showed two bar lengths. The hyphen-minus stays out of the face, so a hyphen in a date or an id keeps its own width. Write negatives with U+2212 to get the tabular sign — `@weasel-js/quantity`'s `qty` and `formatNumber` already do.
