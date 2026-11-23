---
'@weasel-js/font': patch
---

DOM text in an installed face with no PostScript name loads the face's bytes, not a `local("")` that names no font.

<!-- entry: fix visual -->
