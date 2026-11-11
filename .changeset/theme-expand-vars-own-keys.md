---
'@weasel-js/theme': patch
---

`expandVars` treats a `var()` named like an `Object.prototype` member as a name the theme lacks, taking the fallback or throwing its usual error.

<!-- entry: rank=-5 fix -->
