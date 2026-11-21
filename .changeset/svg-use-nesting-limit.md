---
'@weasel-js/svg': patch
---

Importing SVG counts each `<use>` reference toward the nesting limit. A long chain of references leaves the rest of the document drawn.

<!-- entry: fix data -->
