---
"@weasel-js/registry": patch
"@weasel-js/storage": patch
---

`isPlainObject` and `isPlainPrototype` no longer take an object whose prototype is a bare `Object.create(null)` for another realm's plain object. `deepEqual` and everything else that asks follow, and `@weasel-js/storage`'s JSON adapters no longer warn about a foreign object carrying `Symbol.toStringTag`.

<!-- entry: rank=-5 fix -->
