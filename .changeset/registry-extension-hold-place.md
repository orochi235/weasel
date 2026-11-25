---
'@weasel-js/registry': patch
---

An extension registry keeps an id in its place in `entries()` when it is released and registered again in the same tick, as a React effect re-running does.

<!-- entry: fix -->
