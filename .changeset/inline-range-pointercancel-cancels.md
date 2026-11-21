---
'@weasel-js/ui': patch
---

An `InlineRange` drag whose pointer the browser takes away (a scroll or a pinch starts) now cancels: it sends `onValueInput` the value the drag began from, then `onValueCancel`, and no `onValueChange`.

<!-- entry: fix -->
