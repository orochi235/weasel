---
"@weasel-js/geom": patch
---

`trimNumber` writes a number past about 1e302 as the number it is. It wrote `Infinity`, so `pathToD` and `@weasel-js/svg`'s `serializeSvg` could write path data and a viewBox no reader accepts.
