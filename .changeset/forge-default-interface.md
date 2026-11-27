---
'@weasel-js/forge': patch
---

Forge's story indexer no longer reads `export default interface …`, or a bodiless `export default function` overload, as a module's runtime default export.

<!-- entry: rank=-5 fix -->
