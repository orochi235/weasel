---
'@weasel-js/core': patch
---

Resize constraints, and insert behaviors on a canvas with a scene, get a working `ctx.adapter`, as move and rotate behaviors do. It was `undefined` behind its type, so a behavior that called it threw.

<!-- entry: fix -->
