---
'@weasel-js/font': patch
---

A local font that reports an empty PostScript name loads its outlines from the file's first face, as DOM text already did, rather than failing on the canvas.

<!-- entry: fix -->
