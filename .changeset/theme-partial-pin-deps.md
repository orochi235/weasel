---
"@weasel-js/theme": patch
---

A token shown through a partial pin follows its own axes in the generated stylesheet.

`axisDependencies` keeps what a pin replaces among a token's dependencies wherever the pin has no value: a `by` pin that leaves some axis values out, or a pin naming a seed that some selection leaves unset.

<!-- entry: fix -->
