---
"@weasel-js/theme": patch
---

A definition whose axes were loaded malformed now derives and bakes with the fault reported. An axis with no values enumerates no selections instead of throwing in `enumerateSelections` (and so in `bake`); an axis whose default is not a string is reported and gets no value in a full selection, where it used to throw converting the default to text; and an axis named `__proto__` is reported as a name an axis cannot take, as a token's is. `fullSelection` also reads only a selection's own entries.
