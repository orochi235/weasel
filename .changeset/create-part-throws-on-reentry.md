---
'@weasel-js/registry': patch
---

A `createPart` reader throws when `make` reads the part it is making for the same owner, instead of making that owner two parts.

<!-- entry: fix -->
