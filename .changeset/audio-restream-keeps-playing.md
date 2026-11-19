---
'@weasel-js/audio': patch
---

Restreaming an element leaves its current stream playing when the new `stream` call throws or is dropped.

A call naming an unknown bus, or made while the context is locked or the engine disposed, used to stop the music first.

<!-- entry: fix -->
