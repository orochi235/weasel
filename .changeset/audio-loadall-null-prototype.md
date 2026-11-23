---
'@weasel-js/audio': patch
---

`loadAll` returns a record with no prototype, so a misspelled key such as `sounds.constructor` reads `undefined` rather than an `Object.prototype` member.

<!-- entry: fix -->
