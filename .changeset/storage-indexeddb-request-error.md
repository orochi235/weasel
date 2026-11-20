---
'@weasel-js/storage': patch
---

An IndexedDB adapter call whose request fails rejects with that request's error, such as a `ConstraintError`, rather than `null`.

<!-- entry: fix -->
