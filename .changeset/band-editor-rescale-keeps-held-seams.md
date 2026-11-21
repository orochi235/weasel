---
'@weasel-js/ui': patch
---

Rescaling a `BandEditor`'s range leaves a seam held by locked bands at exactly its value, rather than off by rounding.

<!-- entry: fix -->
