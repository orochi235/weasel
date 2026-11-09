---
"@weasel-js/quantity": patch
"@weasel-js/prefs": patch
"@weasel-js/ui": patch
---

`@weasel-js/quantity` exports `decimalPlaces`, the one count of the decimal places a number is written with, exponent form included and capped at 20. Stepping, the readout a slider step implies, the token scale slider and a linear pref unit all count places with it, so a step of `1e-7` shows seven places rather than six, and a value typed at a unit scale written as `1e-7` is stored without binary dust.
