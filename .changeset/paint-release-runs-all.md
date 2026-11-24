---
'@weasel-js/renderer': patch
---

When a paint kind's `onRelease` callback throws, the renderer still frees every other paint kind's resources before passing the error on.

<!-- entry: fix -->
