---
"@weasel-js/core": patch
---

`replaceDoc` clears a document value named like an `Object.prototype` member (`toString`, `constructor`) when the new values do not hold it. It read such a key as present in every object and kept it.
