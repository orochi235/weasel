---
'@weasel-js/svg': patch
---

Importing SVG counts each `<use>` reference toward the nesting limit, so a long chain of references draws the rest of the document instead of failing the whole parse.

<!-- entry: fix data -->
