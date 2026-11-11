---
"@weasel-js/theme": patch
---

A semantic rule naming a ramp called `toString`, `constructor`, or another `Object.prototype` member that the definition does not declare is now reported as `invalid`, as any other missing ramp is. `derive` used to throw a `TypeError` for a step or contrast rule, and to read a token of such a name through the prototype when measuring color.
