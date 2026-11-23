---
'@weasel-js/font': patch
---

GPOS kerning skips a lookup or pair set that a font names past the end of its list, instead of reading other bytes of the font as one.

<!-- entry: fix -->
