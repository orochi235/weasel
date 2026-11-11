---
'@weasel-js/routing': patch
---

Modifier roles named like an `Object.prototype` member resolve by their own keys. A role named `__proto__` was
dropped from `roleKeysOf`, `resolveRoles`, `platformRoleKeys`, and `rebindRoles`, and one named `toString` read the
prototype's method as its keys, so `roleReader` answered a function and resolving it threw.
