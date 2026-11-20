---
'@weasel-js/renderer': patch
'@weasel-js/svg': patch
---

Mesh gradients with `rgb(…)`, `hsl(…)` or `oklch(…)` corner colors survive SVG export and import. A patch's colors are now written `;`-separated, and files with space-separated colors still read.

<!-- entry: fix data -->
