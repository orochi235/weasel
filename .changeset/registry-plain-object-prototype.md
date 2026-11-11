---
"@weasel-js/registry": patch
"@weasel-js/storage": patch
---

`isPlainObject` and `isPlainPrototype` no longer take an object whose prototype is a bare `Object.create(null)` for another realm's plain object: a foreign `Object.prototype` is told by its own `hasOwnProperty` and `isPrototypeOf`. `deepEqual`, and everything else that asks, follows. `@weasel-js/storage`'s JSON adapters judge plain objects with it too, so a foreign object carrying `Symbol.toStringTag` no longer draws a warning.
