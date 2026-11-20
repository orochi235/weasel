---
'@weasel-js/registry': patch
---

A keyed emitter's `clear(key)` called from a listener stops that emit from calling the key's listeners that have not had their turn yet.

<!-- entry: fix -->
