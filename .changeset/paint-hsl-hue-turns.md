---
"@weasel-js/paint": patch
---

`hslToSrgb` reads a hue of any number of turns: `hslToSrgb(720, 1, 0.5)` is red, as `hsl(720 100% 50%)` is.

<!-- entry: fix -->
