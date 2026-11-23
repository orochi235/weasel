---
'@weasel-js/core': patch
---

An `AnchorState` that passes `extensions` must also pass `getNode`, as its type now says.

One without it warns once, rather than silently offering none of the extensions' parts.

<!-- entry: fix -->
