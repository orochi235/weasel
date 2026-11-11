---
"@weasel-js/theme": patch
---

A categorical ramp's gates are read by what each one takes: `surface` a hex color, `order` `"hue"` or `"farthest"`, and every other gate a finite number. Any other value is reported as `invalid`. A non-hex `surface` used to make `derive` throw, and a `NaN` gate or an unknown order was used as given.
