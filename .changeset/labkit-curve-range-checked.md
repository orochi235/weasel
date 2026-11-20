---
'@weasel-js/labkit': patch
---

`f.curve().range()` throws on a non-finite bound or a `min` above `max`, as `f.number().range()` does.

<!-- entry: fix -->
