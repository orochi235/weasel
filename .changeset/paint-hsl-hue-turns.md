---
"@weasel-js/paint": patch
---

`hslToSrgb` reads a hue of any number of turns: `hslToSrgb(720, 1, 0.5)` is red, as `hsl(720 100% 50%)` is, where it used to come back black, and past one turn below zero with negative channels. `srgbToHsl` keeps saturation in 0..1 for a color within float noise of white or black, where it used to answer more than 1 or `Infinity`, which turned an `'hsl'` interpolation or mix of such a color into `NaN`.
