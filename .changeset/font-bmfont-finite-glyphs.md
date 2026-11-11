---
"@weasel-js/font": patch
---

`parseBmFont` refuses an atlas whose glyph or kerning entry is not an object or holds a field that is not a finite
number, naming the entry and the field (`parseBmFont: chars[3].yoffset must be a finite number`). It read such an
entry as it stood, and text set in it drew NaN geometry, or threw a `TypeError` for a null entry.
