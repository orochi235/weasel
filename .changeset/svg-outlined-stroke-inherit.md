---
'@weasel-js/svg': patch
---

A path whose inner- or outer-aligned (or variable-width) stroke it takes from its group, as `svgNodesFromKit` writes a `'inherit'` stroke, no longer draws a centered stroke under its outline in exported SVG. The path left out its `stroke-width="0"` to inherit the group's stroke, and so picked up the group's real width.
