---
"@weasel-js/forge": patch
---

A CSF story's args, argTypes and parameters read a key named like an `Object.prototype` member as the story's own. That includes `__proto__`, `toString` and `constructor`.

<!-- entry: rank=-5 fix -->
