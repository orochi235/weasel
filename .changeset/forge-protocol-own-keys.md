---
"@weasel-js/forge": patch
---

A story control keyed like an `Object.prototype` member reaches the workshop with its own schema and validation errors. That includes `__proto__`, `toString` and `constructor`.

<!-- entry: rank=-5 fix -->
