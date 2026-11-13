---
'@weasel-js/text': minor
---

Arabic, Devanagari or another joining script laid out with no shaper registered warns once, naming the fix.

The warning names `registerShaper(await loadShaper())`, as right-to-left text with no bidi engine already did.

`warnShapingWithoutEngine(codePoints, who?)` gives the same warning from a caller that lays text out on its own.

<!-- entry: api behavior -->
