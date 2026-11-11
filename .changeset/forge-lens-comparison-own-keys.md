---
"@weasel-js/forge": patch
---

A lens's comparison reads only the globals, declarations, and modes it holds as its own. Opposite mode on a mode named like an `Object.prototype` member (`hasOwnProperty`) set the mode global to that member, a function, and naming a comparison whose globals held such a key, `__proto__` included, threw.
