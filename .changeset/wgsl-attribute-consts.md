---
'@weasel-js/renderer': patch
---

A custom WGSL shader may give `@group`, `@binding`, and `@location` a module-scope const or spaced number. One it cannot read throws.

<!-- entry: fix -->
