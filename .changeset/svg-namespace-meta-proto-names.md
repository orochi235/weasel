---
'@weasel-js/svg': patch
---

`parseSvg` keeps namespaced elements and attributes named `constructor`, `toString` or `__proto__` as data, where one used to throw or change the meta object's prototype.

`serializeSvg` likewise reads only the namespace meta a document holds.

<!-- entry: fix data -->
