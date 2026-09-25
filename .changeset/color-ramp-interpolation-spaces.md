---
'@weasel-js/paint': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Color ramps can interpolate in OKLab, HSL, sRGB and linear sRGB as well as OKLCH. `@weasel-js/ui` adds `colorRamp(from, to, steps, options)` and `rampColor(from, to, t, options)`, whose `space` option picks the space (default `'oklch'`), `hue` picks the shorter or longer arc in the polar spaces, and `chroma` applies a `ChromaCurve` after interpolation in any space. Underneath, `@weasel-js/paint` (re-exported from core) adds `interpolateSrgb` with the `ColorInterpolationSpace` and `HueInterpolation` types, plus float-precision `srgbToLinear`, `linearToSrgb`, `linearSrgbToOklab`, `oklabToLinearSrgb`, `srgbToHsl` and `hslToSrgb`. The forge story `ui/Color/ColorRamp` shows the same endpoints ramped in each space.
