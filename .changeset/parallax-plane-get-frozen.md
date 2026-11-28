---
'@weasel-js/parallax': patch
---

A parallax plane's `get` answers frozen opts, so editing them in place throws instead of moving the plane without notifying anyone; write through `set`.

<!-- entry: fix -->
