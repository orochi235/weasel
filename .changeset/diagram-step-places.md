---
"@weasel-js/diagram": patch
---

`formatParam` counts a step's decimal places with `decimalPlaces` from `@weasel-js/quantity`, now a dependency, so a step written in exponent form keeps every place its mantissa carries: a step of `1.5e-7` shows eight places, not seven.
