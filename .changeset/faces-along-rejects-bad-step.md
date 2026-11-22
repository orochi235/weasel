---
'@weasel-js/path-tools': patch
---

`facesAlong` throws a `RangeError` for a `step` that is zero, negative, or not finite, where a zero step froze the page.

<!-- entry: fix -->
