---
'@weasel-js/routing': patch
---

A modifier role named like an `Object.prototype` member, such as `__proto__` or `toString`, resolves by its own keys.

`roleKeysOf`, `resolveRoles`, `platformRoleKeys`, `rebindRoles` and `roleReader` all read it that way.

<!-- entry: rank=-5 fix -->
