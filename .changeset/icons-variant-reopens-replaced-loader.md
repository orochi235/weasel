---
'@weasel-js/icons': patch
---

A variant whose loader is replaced while a load is in flight, and whose load then fails, goes back to `idle`, so a mounted `useIconVariant` loads it from the new loader.

<!-- entry: fix -->
