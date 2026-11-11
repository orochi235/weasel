---
"@weasel-js/theme": patch
---

A theme whose axes loaded malformed derives and bakes with each fault reported, rather than throwing.

An axis with no values enumerates no selections in `enumerateSelections` and `bake`; an axis whose default is not a string is reported and gets no value in a full selection; and an axis named `__proto__` is reported as a name an axis cannot take. `fullSelection` reads only a selection's own entries.

<!-- entry: fix -->
