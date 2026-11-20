---
'@weasel-js/labkit': patch
---

`setInstruments` with new instrument objects writes only the trials and snapshots whose config it changes, rather than rewriting every one of those instruments.

<!-- entry: fix perf -->
