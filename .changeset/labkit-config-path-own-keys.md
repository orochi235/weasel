---
"@weasel-js/labkit": patch
---

Config paths read only a record's own keys. A config leaf named `constructor`, `toString` or another key every object inherits now loads at its default and reads as absent until set, rather than as the function `Object.prototype` holds there; a `__proto__` key is kept as data.
