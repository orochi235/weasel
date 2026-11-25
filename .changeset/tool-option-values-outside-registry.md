---
'@weasel-js/routing': patch
---

`useToolOptionValues` does nothing in a component with no dep registry above it, as documented, instead of throwing.

<!-- entry: fix -->
