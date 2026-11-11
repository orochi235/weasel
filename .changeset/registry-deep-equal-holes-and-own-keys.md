---
"@weasel-js/registry": patch
---

`deepEqual` reads an array's hole as `undefined`. It skipped holes, so `[, 1]` equaled `[5, 1]` while `[5, 1]` did not equal `[, 1]`. Under `undefinedAsAbsent` it reads only a key's own value, so a `__proto__` or `constructor` key one side holds no longer compares against the other side's inherited member: `{ __proto__: {} }` (as `JSON.parse` builds it) no longer equals `{}`, and `{ constructor: undefined }` now does.
