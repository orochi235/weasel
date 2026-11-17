---
'@weasel-js/labkit': patch
---

A started job without `auto` runs again when its `key` changes, dropping the run in flight.

One never started, or canceled since, stays idle.

<!-- entry: fix -->
