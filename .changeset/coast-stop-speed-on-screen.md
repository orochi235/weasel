---
'@weasel-js/core': patch
---

A flung pan coasts for as long on screen at any zoom: `inertia.minSpeed` is measured in screen pixels per ms.

`useDecayLoop`'s `start` takes a `speedScale` that turns its velocity into the units `minSpeed` is in.

<!-- entry: fix api -->
