---
"@weasel-js/registry": patch
---

Under `undefinedAsAbsent`, `deepEqual` compares only a key's own value, never an inherited member of the same name. So `{ __proto__: {} }` (as `JSON.parse` builds it) no longer equals `{}`, and `{ constructor: undefined }` now does.

<!-- entry: rank=-5 fix -->
