---
"@weasel-js/forge": patch
---

A lens's comparison reads only the globals, declarations and modes it holds as its own. A mode or key named like an `Object.prototype` member no longer breaks it.

<!-- entry: rank=-5 fix -->
