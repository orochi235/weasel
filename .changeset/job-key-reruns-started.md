---
'@weasel-js/labkit': patch
---

A job without `auto` that has been started runs again when its `key` changes, dropping the run in flight, as its docs say; one never started or since canceled stays idle.

<!-- entry: fix -->
