---
'@weasel-js/ui': patch
---

Canceling a `Slider` thumb drag that has come back to where it began still calls `onCancel`, as canceling a region drag does.

<!-- entry: fix -->
