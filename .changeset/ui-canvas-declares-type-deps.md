---
'@weasel-js/ui-canvas': patch
---

`@weasel-js/ui-canvas`'s types resolve on a clean install.

It now depends on `@weasel-js/geom`, `@weasel-js/history` and `@weasel-js/quantity`, and takes `@weasel-js/guides` as a peer: `Rulers` reads a rulers model made by `@weasel-js/guides`, so an app showing rulers installs that package itself.

<!-- entry: fix -->
