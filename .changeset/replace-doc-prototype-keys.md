---
"@weasel-js/core": patch
---

`replaceDoc` clears a document value named like an `Object.prototype` member, such as `toString`, when the new values do not hold it.

<!-- entry: rank=-5 fix -->
