---
'@weasel-js/icons-plugin': patch
---

`icon()` calls imported through an extensionless `./icons.gen` are rewritten when the generated file is `.tsx`, `.jsx`, `.mts`, `.mjs`, `.cts`, or `.cjs`.

<!-- entry: fix -->
