---
'@weasel-js/renderer': patch
---

A tile pattern that failed before `OffscreenCanvas` existed draws once it does, even after another pattern fails first.

<!-- entry: fix visual -->
