---
'@weasel-js/paint': patch
'@weasel-js/theme': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

One hex color reader. `@weasel-js/paint` exports `parseHexBytes` (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` to four 0–255 channels, `null` otherwise) and `hexToRgbBytes`, and core re-exports both; core's `parseColor` and `normalizeHex`, paint's `hexToOklchDeg`, `contrastLineColor`, and `hexToColorLiteral`, theme's `hexToRgb` and `withAlpha`, and ui's token panel all read through it. Fixed along the way: theme's `hexToRgb` (and `luminance`, `contrast`, `toLab` on top of it) read `#abc` as `#000abc` and shifted an eight-digit hex's alpha into blue; `contrastLineColor` did not read a four-digit background. Behavior change: `hexToOklchDeg`, `hexToRgb`, and `parseColor` now throw on a malformed hex where they computed from `NaN`.
