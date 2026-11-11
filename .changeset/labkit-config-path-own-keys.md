---
"@weasel-js/labkit": patch
---

Config paths read only a record's own keys. A leaf named `constructor` or `toString` loads at its default and reads as absent until set, and a `__proto__` key is kept as data.

<!-- entry: rank=-5 fix -->
