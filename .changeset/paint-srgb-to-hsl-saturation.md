---
"@weasel-js/paint": patch
---

`srgbToHsl` keeps saturation in 0..1 for a color within float noise of white or black. An `'hsl'` interpolation or mix of one is no longer `NaN`.

<!-- entry: fix -->
