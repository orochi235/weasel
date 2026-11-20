---
'@weasel-js/path-tools': patch
---

`cutPathAtAnchor` is disabled off every anchor and on an open subpath, so the click falls through to other bindings.

<!-- entry: fix -->
