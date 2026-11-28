---
'@weasel-js/forge': patch
---

Forge's story indexer follows `const { 0: zero } = ns`, off a namespace import, to the export named `"0"`.

<!-- entry: rank=-10 fix -->
