---
'@weasel-js/renderer': patch
---

A tile pattern spec read from JSON with a `__proto__` key gets a texture of its own, where it used to share the tile of the same spec without that key.

<!-- entry: fix -->
