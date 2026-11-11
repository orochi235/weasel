---
'@weasel-js/routing': patch
---

A tool option keyed `__proto__` reads as an option. `toolOptionParams` and `heldToolOptions` assigned it, which set
the result's prototype instead, so the option's value and default never reached the action.
