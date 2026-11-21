---
'@weasel-js/svg': patch
---

Importing SVG resolves a gradient stop's `stop-color: currentColor` against the `color` in effect on the stop, instead of reading it as black.

<!-- entry: fix visual -->
