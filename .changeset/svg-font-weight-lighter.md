---
'@weasel-js/svg': patch
---

SVG import reads `font-weight="lighter"`, and computes `bolder` and `lighter` over the inherited weight.

A weight CSS rejects leaves the inherited one standing.

<!-- entry: fix data -->
