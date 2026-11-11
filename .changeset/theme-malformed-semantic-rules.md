---
"@weasel-js/theme": patch
---

`derive` reports a semantic rule whose fields have the wrong types as `invalid` rather than throwing.

That covers a `ref` or `from` that is not a name, a non-finite `offset` or `alpha`, an unknown `dir`, and a `contrast` or `check` without a number and a list of names. `axisDependencies`, which the theme editor calls mid-edit, no longer throws for a rule that is not an object.

<!-- entry: fix -->
