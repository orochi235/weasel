---
'@weasel-js/parallax': patch
---

A parallax plane's `get` answers frozen opts, so an in-place edit throws rather than moving the plane unheard. Write through `set`.

<!-- entry: fix -->
