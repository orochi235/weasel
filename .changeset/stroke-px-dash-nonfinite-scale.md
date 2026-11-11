---
"@weasel-js/stroke": patch
"@weasel-js/renderer": patch
---

A `{ px }` stroke under an infinite scale keeps its dashes, rather than drawing solid.

Its dashes and dash offset resolve as its width does, left as given, in `strokeAtScale`, `strokeToPath` and the renderer.

<!-- entry: rank=-5 fix visual -->
