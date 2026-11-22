---
'@weasel-js/svg': patch
---

A filled, unstroked path's unfilled open subpaths are left out of SVG export. The path is written, and reads back, as one `<path>` of its closed subpaths rather than a group with an extra path.

<!-- entry: fix data -->
