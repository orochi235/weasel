---
'@weasel-js/font': patch
---

Text using more canvas glyphs than the atlas pages hold no longer empties the pages over and over as they refill.

The glyphs that do not fit stay undrawn, with one warning, and the rest hold steady.

<!-- entry: fix visual perf -->
