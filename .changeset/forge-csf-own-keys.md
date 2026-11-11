---
"@weasel-js/forge": patch
---

A CSF story's args and argTypes keyed like an `Object.prototype` member are read as the story's own. An argType keyed `__proto__` gets its control rather than replacing the schema's prototype; an argTypes-only key named `toString` or `constructor` gets a control rather than being skipped as an arg holding a function; an arg named `constructor` with no argType is no longer labeled `Object`; and the part of an arg the frame puts back after a control edit keeps a `__proto__` key as a key. Parameters keyed `__proto__` merge as own keys too.
