---
'@weasel-js/ui': patch
---

A `ToolbarDock` slot stops reserving a bar's least length once the content that reported it unmounts, so a squeezed row can shrink that bar again.

<!-- entry: fix -->
