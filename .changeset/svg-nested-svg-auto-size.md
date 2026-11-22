---
'@weasel-js/svg': patch
---

`parseSvg` reads a nested `<svg>` sized `auto` as 100% of its viewport. Percentage lengths inside it resolve rather than warn.

<!-- entry: fix data -->
