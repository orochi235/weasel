---
'@weasel-js/forge': patch
---

A full capture queue no longer reads as captures being unavailable: the endpoint answers it with 429 and `Retry-After`.

<!-- entry: fix -->
