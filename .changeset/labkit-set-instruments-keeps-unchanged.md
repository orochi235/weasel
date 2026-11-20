---
'@weasel-js/labkit': patch
---

`setInstruments` with new instrument objects writes only the trials and snapshots whose config it changes. It no longer rewrites every one.

<!-- entry: fix perf -->
