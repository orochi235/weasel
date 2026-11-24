---
'@weasel-js/loupe': patch
---

An eyedropper whose sampler throws on a hover clears its color to `null`, as a failed asynchronous read does, and still throws.

<!-- entry: fix -->
