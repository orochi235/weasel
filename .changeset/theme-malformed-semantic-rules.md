---
"@weasel-js/theme": patch
---

`derive` reports a semantic rule whose fields have the wrong types as `invalid`: a `ref` or `from` that is not a name, a non-finite `offset` or `alpha`, an unknown `dir`, a `contrast` or `check` without a number and a list of names. It used to throw a `TypeError` for several of them, and `axisDependencies`, which the theme editor calls mid-edit, threw for a rule that is not an object at all.
