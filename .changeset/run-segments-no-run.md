---
'@weasel-js/geom': patch
---

`runSegments` answers 0 for a run index that names no run, such as a fractional, negative, or out-of-range one, rather than throwing.

<!-- entry: fix -->
