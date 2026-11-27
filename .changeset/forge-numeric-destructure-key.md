---
'@weasel-js/forge': patch
---

Forge's story indexer follows a name destructured off a namespace import by a numeric key, as in `const { 0: zero } = ns`, to the export named `"0"`.

<!-- entry: rank=-10 fix -->
