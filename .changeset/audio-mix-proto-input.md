---
"@weasel-js/audio": patch
---

`createMixNode` gives an input named `__proto__` its own port and level param. It set the def's `inputs` and `params` prototypes instead, so the mix had no such port.
