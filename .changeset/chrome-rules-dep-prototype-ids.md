---
'@weasel-js/core': patch
---

The `chromeRules` dep's `get` answers `undefined` for an id with no rule, even one named like an `Object.prototype` member.

<!-- entry: fix -->
