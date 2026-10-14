---
'@weasel-js/renderer': patch
---

Text faked bold shares a draw with the text around it. The shift on the distance field's threshold rides each glyph's vertices where it was a uniform, so a bold run in a face with no bold atlas no longer breaks the batch on either side of it.
