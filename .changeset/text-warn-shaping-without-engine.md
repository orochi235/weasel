---
'@weasel-js/text': minor
---

Laying out Arabic, Devanagari or another script whose letters join with no shaper registered warns once, naming `registerShaper(await loadShaper())`, as right-to-left text with no bidi engine already did.

`warnShapingWithoutEngine(codePoints, who?)` gives the same warning from a caller that lays text out on its own.

<!-- entry: api behavior -->
