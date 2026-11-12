---
'@weasel-js/renderer': patch
---

`setImageMinification` on a disposed `WeaselRenderer` does nothing, rather than leaving a cache that caps other renderers' texture size.

<!-- entry: fix -->
