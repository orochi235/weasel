---
'@weasel-js/storage': patch
---

An IndexedDB adapter warns when its upgrade waits on another tab. Its reads and writes stay pending until that tab closes the database.

<!-- entry: fix -->
