---
'@weasel-js/ui': patch
---

An `InlineRange` drag cancels when the browser takes its pointer away for a scroll or a pinch. It sends `onValueInput` the value the drag began from, then `onValueCancel`, and no `onValueChange`.

<!-- entry: fix -->
