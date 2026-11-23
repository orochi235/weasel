---
'@weasel-js/font': patch
---

DOM text set in an installed face with no PostScript name loads the face's own bytes, rather than a `local("")` source that names no font.

<!-- entry: fix visual -->
