---
'@weasel-js/forge': patch
---

forge's story index reads a computed literal key such as `['title']` in a meta or a story. A later one wins over an earlier plain key, as at runtime.

<!-- entry: fix -->
