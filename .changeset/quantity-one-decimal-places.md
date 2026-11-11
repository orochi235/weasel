---
"@weasel-js/quantity": patch
"@weasel-js/prefs": patch
"@weasel-js/ui": patch
---

A step of `1e-7` shows seven decimal places, and a value typed at a unit scale written as `1e-7` is stored without binary dust.

`@weasel-js/quantity` exports `decimalPlaces`, which counts the decimal places a number is written with, exponent form included, capped at 20. Stepping, a slider step's readout, the token scale slider and a linear pref unit all count with it.

<!-- entry: fix api -->
