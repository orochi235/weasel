---
'@weasel-js/gestures': patch
---

A drop, carry, or paste binding whose `types` include a catch-all glob (`*` or `*/*`) no longer ties with one naming a real MIME type such as `text/csv`; the named one wins.

<!-- entry: fix -->
