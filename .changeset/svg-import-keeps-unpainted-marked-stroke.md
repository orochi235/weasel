---
'@weasel-js/svg': patch
---

SVG import keeps the marker heads of a path whose `stroke` is `none`, and SVG export writes them back under `stroke="none"`.

<!-- entry: fix data -->
