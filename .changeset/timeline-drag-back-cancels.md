---
'@weasel-js/ui': patch
---

A `Timeline` key dragged away and released on its own time calls `onCancel`. Before that it hands `onInput` the tracks it began from, so no preview is left standing.

<!-- entry: fix -->
