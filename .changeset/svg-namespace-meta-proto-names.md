---
'@weasel-js/svg': patch
---

`parseSvg` keeps namespaced elements and attributes named `constructor` or `__proto__` as data, where one used to throw.

`serializeSvg` likewise reads only the namespace meta a document holds.

<!-- entry: fix data -->
