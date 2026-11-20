---
'@weasel-js/font': patch
---

`registerFont` refuses a multi-page BMFont atlas, naming the first glyph past page 0, rather than drawing those glyphs from page 0's image.

<!-- entry: fix -->
