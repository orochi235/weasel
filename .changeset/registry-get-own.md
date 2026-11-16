---
'@weasel-js/registry': minor
---

`@weasel-js/registry` exports `getOwn` and `hasOwnKey`, which read and test a key among an object's own keys only.

A key named `constructor` or `toString` reads as absent, where `table[key]` and `key in table` find `Object.prototype`'s member.

<!-- entry: api -->
