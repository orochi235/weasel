---
'@weasel-js/svg': patch
---

An SVG element inside a filled `<g>` that sets only `fill-opacity` keeps its own translucent fill on import and export, instead of taking the group's fill at full opacity.

<!-- entry: fix visual data -->
