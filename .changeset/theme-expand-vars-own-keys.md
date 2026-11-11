---
'@weasel-js/theme': patch
---

`expandVars` reads a `var()` named like an `Object.prototype` member (`var(__proto__)`, `var(constructor)`) as a name the theme does not have: it takes the fallback, or throws its usual error. It used to fail with a `TypeError`.
