---
"@weasel-js/theme": patch
---

`axisDependencies` keeps what a pin replaces among a token's dependencies wherever the pin has no value: a `by` pin that leaves some axis values out, or a pin naming a seed that some selection leaves unset. It used to take the pin's axes alone, so the generated stylesheet wrote the token only in blocks for the pin's axes, and the value shown through from a ramp or rule did not follow its own axes.
