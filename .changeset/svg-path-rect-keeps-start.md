---
'@weasel-js/svg': patch
---

`parseSvg` keeps a rectangular `<path>` drawn from another corner or counterclockwise as a path, so its dashes start where written.

<!-- entry: fix visual -->
