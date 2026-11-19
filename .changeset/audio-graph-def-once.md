---
'@weasel-js/audio': patch
---

An `AudioGraph` throws on `add` or `replace` given a node def it holds or has held, rather than disposing it under a live node.

<!-- entry: fix -->
