---
"@weasel-js/ui": patch
---

The selection panel reads a node's value only where the node holds it: a schema key named like an `Object.prototype` member (`data.toString`, `data.constructor`) read the inherited function, and now reads as unset. Writing such a key into an array value keeps it an own key, where `__proto__` replaced the array's prototype.
